package com.example.vault_drive.service;

import com.example.vault_drive.dto.*;
import com.example.vault_drive.entity.*;
import com.example.vault_drive.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UploadService {

    private static final Logger log = LoggerFactory.getLogger(UploadService.class);

    private final UploadSessionRepository uploadSessionRepository;
    private final FolderRepository folderRepository;
    private final FileItemRepository fileItemRepository;
    private final UserStorageRepository userStorageRepository;
    private final StoragePlanRepository storagePlanRepository;
    private final NotificationRepository notificationRepository;
    private final AccessControlService accessControlService;
    private final TransactionTemplate transactionTemplate;

    private final Path uploadBaseDir = Paths.get("uploads");

    // Thread-safe lock map per session to prevent race conditions during chunk updates
    private final ConcurrentHashMap<String, Object> sessionLocks = new ConcurrentHashMap<>();

    public UploadService(UploadSessionRepository uploadSessionRepository,
            FolderRepository folderRepository,
            FileItemRepository fileItemRepository,
            UserStorageRepository userStorageRepository,
            StoragePlanRepository storagePlanRepository,
            NotificationRepository notificationRepository,
            AccessControlService accessControlService,
            PlatformTransactionManager transactionManager) {
        this.uploadSessionRepository = uploadSessionRepository;
        this.folderRepository = folderRepository;
        this.fileItemRepository = fileItemRepository;
        this.userStorageRepository = userStorageRepository;
        this.storagePlanRepository = storagePlanRepository;
        this.notificationRepository = notificationRepository;
        this.accessControlService = accessControlService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Transactional
    public UploadSessionResponse initUploadSession(User user, UploadInitRequest request) {
        if (request.getTotalSizeBytes() == null || request.getTotalSizeBytes() < 0) {
            throw new RuntimeException("Kích thước file không hợp lệ!");
        }

        long maxAllowedBytes = 4L * 1024 * 1024 * 1024L; // 4GB
        if (request.getTotalSizeBytes() > maxAllowedBytes) {
            throw new RuntimeException("Dung lượng file vượt quá giới hạn tối đa cho phép (4GB)!");
        }

        Folder targetFolder = null;
        if (request.getTargetFolderId() != null) {
            targetFolder = folderRepository.findByIdAndIsDeletedFalse(request.getTargetFolderId())
                    .orElseThrow(() -> new RuntimeException("Folder lưu trữ không tồn tại!"));

            if (Boolean.TRUE.equals(targetFolder.getIsTrashed())) {
                throw new RuntimeException("Không thể upload file vào thư mục rác!");
            }

            if (!accessControlService.hasFolderAccess(user, targetFolder, "EDIT")) {
                throw new RuntimeException("Bạn không có quyền upload file vào thư mục này!");
            }
        }

        // Quota check
        UserStorage userStorage = userStorageRepository.findByUser(user)
                .orElseGet(() -> {
                    StoragePlan defaultPlan = storagePlanRepository.findByName("Free Plan")
                            .orElseGet(() -> storagePlanRepository.save(
                                    new StoragePlan("Free Plan", 10L * 1024 * 1024 * 1024, 0.0)));
                    return userStorageRepository.save(new UserStorage(user, defaultPlan, 0L));
                });

        long maxBytes = userStorage.getPlan().getMaxBytes();
        long projectedUsed = userStorage.getUsedBytes() + request.getTotalSizeBytes();
        if (projectedUsed > maxBytes) {
            long available = Math.max(0, maxBytes - userStorage.getUsedBytes());
            throw new RuntimeException(String.format(
                    "Không thể tạo phiên upload: Dung lượng lưu trữ không đủ! Còn trống: %s, tệp yêu cầu: %s.",
                    formatHumanSize(available), formatHumanSize(request.getTotalSizeBytes())));
        }

        int totalChunks = request.getTotalChunks();
        if (request.getTotalSizeBytes() == 0 && totalChunks <= 0) {
            totalChunks = 1;
        }

        String sessionId = UUID.randomUUID().toString();
        UploadSession session = new UploadSession(
                sessionId,
                user,
                targetFolder,
                request.getFileName(),
                request.getTotalSizeBytes(),
                totalChunks);

        UploadSession savedSession = uploadSessionRepository.save(session);

        // Ensure chunk directory exists
        try {
            Path chunkDir = uploadBaseDir.resolve("chunks").resolve(sessionId);
            Files.createDirectories(chunkDir);
        } catch (IOException e) {
            throw new RuntimeException("Không thể tạo thư mục lưu trữ chunk tạm thời: " + e.getMessage());
        }

        return new UploadSessionResponse(savedSession);
    }

    public UploadSessionResponse uploadChunk(User user, String sessionId, int chunkIndex, MultipartFile chunkFile) {
        if (chunkFile == null) {
            throw new RuntimeException("Chunk file không được để trống!");
        }

        // Fast pre-check without lock
        UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại hoặc đã bị hủy!"));

        if (!session.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
        }

        if (session.getStatus() == UploadSession.Status.COMPLETED) {
            sessionLocks.remove(sessionId);
            throw new RuntimeException("Phiên upload đã hoàn tất!");
        }

        if (session.getStatus() == UploadSession.Status.FAILED) {
            sessionLocks.remove(sessionId);
            throw new RuntimeException("Phiên upload đã thất bại hoặc bị hủy!");
        }

        if (chunkIndex < 0 || chunkIndex >= session.getTotalChunks()) {
            throw new RuntimeException(
                    String.format("Chỉ số chunk không hợp lệ! (%d/%d)", chunkIndex, session.getTotalChunks()));
        }

        // Save chunk to disk OUTSIDE of transaction to avoid holding DB connections
        Path chunkDir = uploadBaseDir.resolve("chunks").resolve(sessionId);
        try {
            if (!Files.exists(chunkDir)) {
                Files.createDirectories(chunkDir);
            }
            Path chunkPath = chunkDir.resolve("chunk_" + chunkIndex + ".part");
            try (InputStream in = chunkFile.getInputStream()) {
                Files.copy(in, chunkPath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("Lỗi khi ghi chunk file {} cho session {}: {}", chunkIndex, sessionId, e.getMessage());
            throw new RuntimeException("Lỗi khi ghi chunk file: " + e.getMessage(), e);
        }

        // Thread-safe update of session record per sessionId
        Object lock = sessionLocks.computeIfAbsent(sessionId, k -> new Object());
        synchronized (lock) {
            int maxRetries = 3;
            for (int attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return transactionTemplate.execute(status -> {
                        UploadSession currentSession = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                                .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại!"));

                        Set<Integer> uploadedSet = parseIndices(currentSession.getUploadedChunkIndices());
                        uploadedSet.add(chunkIndex);

                        currentSession.setUploadedChunkIndices(formatIndices(uploadedSet));
                        currentSession.setUploadedChunksCount(uploadedSet.size());
                        currentSession = uploadSessionRepository.saveAndFlush(currentSession);

                        return new UploadSessionResponse(currentSession);
                    });
                } catch (Exception e) {
                    if (attempt == maxRetries) {
                        log.error("Thất bại khi cập nhật chunk {} cho session {} sau {} lần thử: {}", chunkIndex,
                                sessionId, maxRetries, e.getMessage());
                        throw e;
                    }
                    try {
                        Thread.sleep(50L * attempt);
                    } catch (InterruptedException ignored) {
                    }
                }
            }
        }

        throw new RuntimeException("Không thể lưu tiến trình chunk " + chunkIndex);
    }

    @Transactional(readOnly = true)
    public UploadStatusResponse getSessionStatus(User user, String sessionId) {
        UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại!"));

        if (!session.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
        }

        Set<Integer> uploadedSet = parseIndices(session.getUploadedChunkIndices());
        List<Integer> remainingChunks = new ArrayList<>();
        for (int i = 0; i < session.getTotalChunks(); i++) {
            if (!uploadedSet.contains(i)) {
                remainingChunks.add(i);
            }
        }

        return new UploadStatusResponse(session, remainingChunks);
    }

    @Transactional
    public UploadSessionResponse pauseUploadSession(User user, String sessionId) {
        UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại!"));

        if (!session.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
        }

        if (session.getStatus() == UploadSession.Status.UPLOADING) {
            session.setStatus(UploadSession.Status.PAUSED);
            uploadSessionRepository.save(session);
        }

        return new UploadSessionResponse(session);
    }

    @Transactional
    public UploadStatusResponse resumeUploadSession(User user, String sessionId) {
        UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại!"));

        if (!session.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
        }

        // Self-healing: reconcile chunk files on disk
        Path chunkDir = uploadBaseDir.resolve("chunks").resolve(sessionId);
        if (Files.exists(chunkDir)) {
            Set<Integer> uploadedSet = parseIndices(session.getUploadedChunkIndices());
            boolean changed = false;
            for (int i = 0; i < session.getTotalChunks(); i++) {
                Path chunkPath = chunkDir.resolve("chunk_" + i + ".part");
                if (Files.exists(chunkPath) && !uploadedSet.contains(i)) {
                    uploadedSet.add(i);
                    changed = true;
                }
            }
            if (changed) {
                session.setUploadedChunkIndices(formatIndices(uploadedSet));
                session.setUploadedChunksCount(uploadedSet.size());
            }
        }

        if (session.getStatus() == UploadSession.Status.PAUSED) {
            session.setStatus(UploadSession.Status.UPLOADING);
        }
        uploadSessionRepository.save(session);

        return getSessionStatus(user, sessionId);
    }

    @Transactional
    public UploadSessionResponse cancelUploadSession(User user, String sessionId) {
        try {
            UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                    .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại!"));

            if (!session.getUser().getId().equals(user.getId())) {
                throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
            }

            session.setStatus(UploadSession.Status.FAILED);
            session.setIsDeleted(true);
            session.setDeletedAt(LocalDateTime.now());
            uploadSessionRepository.save(session);

            // Clean chunk files
            cleanupChunkDir(sessionId);

            return new UploadSessionResponse(session);
        } finally {
            sessionLocks.remove(sessionId);
        }
    }

    /**
     * completeUploadSession - Hoàn tất upload và ghép file.
     * TUÂN THỦ NGUYÊN TẮC: Toàn bộ FileChannel I/O chạy HOÀN TOÀN BÊN NGOÀI @Transactional.
     * Chỉ mở một transaction siêu ngắn sau khi ghép file xong để lưu FileItem & cập nhật Quota.
     */
    public FileItemResponse completeUploadSession(User user, String sessionId) {
        try {
            // 1. Pre-check session không khóa DB
            UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                    .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại!"));

            if (!session.getUser().getId().equals(user.getId())) {
                throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
            }

            if (session.getStatus() == UploadSession.Status.COMPLETED) {
                throw new RuntimeException("Phiên upload đã hoàn tất trước đó!");
            }

            Path chunkDir = uploadBaseDir.resolve("chunks").resolve(sessionId);

            // 2. Self-healing check: kiểm tra file chunk vật lý trên đĩa
            Set<Integer> uploadedSet = parseIndices(session.getUploadedChunkIndices());
            boolean allChunksPresent = true;
            for (int i = 0; i < session.getTotalChunks(); i++) {
                Path chunkPath = chunkDir.resolve("chunk_" + i + ".part");
                if (Files.exists(chunkPath)) {
                    uploadedSet.add(i);
                } else {
                    allChunksPresent = false;
                }
            }

            if (!allChunksPresent || uploadedSet.size() < session.getTotalChunks()) {
                throw new RuntimeException(String.format("Chưa upload đủ tất cả các chunk! Đã hoàn tất: %d/%d chunk.",
                        uploadedSet.size(), session.getTotalChunks()));
            }

            // 3. Quota check trước khi ghép
            UserStorage userStorage = userStorageRepository.findByUser(session.getUser())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin bộ nhớ người dùng!"));

            long maxBytes = userStorage.getPlan().getMaxBytes();
            if (userStorage.getUsedBytes() + session.getTotalSizeBytes() > maxBytes) {
                session.setStatus(UploadSession.Status.FAILED);
                uploadSessionRepository.save(session);
                throw new RuntimeException("Vượt quá hạn ngạch dung lượng lưu trữ!");
            }

            // 4. Sinh đường dẫn file đích
            String ext = "";
            String rawFileName = session.getFileName();
            if (rawFileName != null) {
                int lastDot = rawFileName.lastIndexOf('.');
                if (lastDot >= 0 && lastDot < rawFileName.length() - 1) {
                    String candidate = rawFileName.substring(lastDot);
                    if (candidate.matches("^\\.[a-zA-Z0-9]{1,10}$")) {
                        ext = candidate;
                    }
                }
            }
            String storedFileName = UUID.randomUUID().toString() + ext;
            Path destDir = uploadBaseDir.resolve("files").resolve(session.getUser().getId().toString());
            try {
                Files.createDirectories(destDir);
            } catch (IOException e) {
                throw new RuntimeException("Không thể tạo thư mục lưu trữ file: " + e.getMessage());
            }

            Path destFile = destDir.resolve(storedFileName);

            // 5. THAO TÁC GHÉP FILE BẰNG FILECHANNEL HOÀN TOÀN BÊN NGOÀI TRANSACTION
            // Hỗ trợ cả file 0 byte đến file lớn 4GB
            try (FileChannel destChannel = FileChannel.open(destFile, StandardOpenOption.CREATE, StandardOpenOption.WRITE,
                    StandardOpenOption.TRUNCATE_EXISTING)) {
                for (int i = 0; i < session.getTotalChunks(); i++) {
                    Path chunkPath = chunkDir.resolve("chunk_" + i + ".part");
                    if (!Files.exists(chunkPath)) {
                        throw new RuntimeException("Thiếu chunk " + i + " khi tiến hành ghép file!");
                    }
                    try (FileChannel srcChannel = FileChannel.open(chunkPath, StandardOpenOption.READ)) {
                        long position = 0;
                        long size = srcChannel.size();
                        while (position < size) {
                            long transferred = srcChannel.transferTo(position, size - position, destChannel);
                            if (transferred <= 0)
                                break;
                            position += transferred;
                        }
                    }
                }
            } catch (Exception e) {
                try {
                    Files.deleteIfExists(destFile);
                } catch (IOException ignored) {
                }
                log.error("Lỗi trong quá trình ghép các chunk cho session {}: {}", sessionId, e.getMessage());
                throw new RuntimeException("Lỗi trong quá trình ghép các chunk: " + e.getMessage(), e);
            }

            // 6. Dọn dẹp thư mục chunks
            cleanupChunkDir(sessionId);

            // 7. Nhận diện MIME type
            String fileType = "application/octet-stream";
            try {
                String probed = Files.probeContentType(destFile);
                if (probed != null && !probed.isBlank()) {
                    fileType = probed;
                } else {
                    fileType = detectMimeTypeByExtension(session.getFileName());
                }
            } catch (IOException ignored) {
                fileType = detectMimeTypeByExtension(session.getFileName());
            }

            String finalFileType = fileType;
            String storedPath = destFile.toString().replace('\\', '/');

            // 8. TRANSACTION SIÊU NGẮN: Lưu FileItem, cộng dồn Quota và cập nhật UploadSession
            FileItem savedFile = transactionTemplate.execute(status -> {
                UserStorage storage = userStorageRepository.findByUser(session.getUser())
                        .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin bộ nhớ người dùng!"));
                storage.setUsedBytes(storage.getUsedBytes() + session.getTotalSizeBytes());
                userStorageRepository.save(storage);

                FileItem fileItem = new FileItem(
                        session.getFileName(),
                        finalFileType,
                        session.getTotalSizeBytes(),
                        storedPath,
                        session.getTargetFolder(),
                        session.getUser());
                FileItem saved = fileItemRepository.save(fileItem);

                UploadSession currentSession = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                        .orElse(session);
                currentSession.setUploadedChunkIndices(formatIndices(uploadedSet));
                currentSession.setUploadedChunksCount(session.getTotalChunks());
                currentSession.setStatus(UploadSession.Status.COMPLETED);
                uploadSessionRepository.save(currentSession);

                Notification notification = new Notification(
                        session.getUser(),
                        null,
                        "Tải lên hoàn tất",
                        "File '" + session.getFileName() + "' đã được tải lên thành công.",
                        Notification.Type.UPLOAD_COMPLETE);
                notificationRepository.save(notification);

                return saved;
            });

            log.info("Ghép file hoàn tất thành công: session={}, fileName='{}', size={} bytes",
                    sessionId, session.getFileName(), session.getTotalSizeBytes());

            return new FileItemResponse(savedFile, false, "OWNER");
        } finally {
            // Đảm bảo luôn dọn sạch lock bộ nhớ cho sessionId tránh rò rỉ RAM
            sessionLocks.remove(sessionId);
        }
    }

    private String detectMimeTypeByExtension(String fileName) {
        if (fileName == null)
            return "application/octet-stream";
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf"))
            return "application/pdf";
        if (lower.endsWith(".png"))
            return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
            return "image/jpeg";
        if (lower.endsWith(".gif"))
            return "image/gif";
        if (lower.endsWith(".svg"))
            return "image/svg+xml";
        if (lower.endsWith(".mp4"))
            return "video/mp4";
        if (lower.endsWith(".avi"))
            return "video/x-msvideo";
        if (lower.endsWith(".mov"))
            return "video/quicktime";
        if (lower.endsWith(".mp3"))
            return "audio/mpeg";
        if (lower.endsWith(".zip"))
            return "application/zip";
        if (lower.endsWith(".rar"))
            return "application/x-rar-compressed";
        if (lower.endsWith(".tar"))
            return "application/x-tar";
        if (lower.endsWith(".gz"))
            return "application/gzip";
        if (lower.endsWith(".doc"))
            return "application/msword";
        if (lower.endsWith(".docx"))
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".xls"))
            return "application/vnd.ms-excel";
        if (lower.endsWith(".xlsx"))
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".ppt"))
            return "application/vnd.ms-powerpoint";
        if (lower.endsWith(".pptx"))
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if (lower.endsWith(".txt"))
            return "text/plain";
        if (lower.endsWith(".json"))
            return "application/json";
        return "application/octet-stream";
    }

    public static Set<Integer> parseIndices(String indicesStr) {
        Set<Integer> result = new HashSet<>();
        if (indicesStr == null || indicesStr.isBlank()) {
            return result;
        }
        String[] parts = indicesStr.split(",");
        for (String part : parts) {
            part = part.trim();
            if (part.isEmpty())
                continue;
            int dashIdx = part.indexOf('-');
            if (dashIdx > 0) {
                try {
                    int start = Integer.parseInt(part.substring(0, dashIdx));
                    int end = Integer.parseInt(part.substring(dashIdx + 1));
                    for (int i = start; i <= end; i++) {
                        result.add(i);
                    }
                } catch (NumberFormatException ignored) {
                }
            } else {
                try {
                    result.add(Integer.parseInt(part));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return result;
    }

    public static String formatIndices(Set<Integer> set) {
        if (set == null || set.isEmpty()) {
            return "";
        }
        List<Integer> list = new ArrayList<>(set);
        Collections.sort(list);
        StringBuilder sb = new StringBuilder();
        int start = list.get(0);
        int prev = start;
        for (int i = 1; i < list.size(); i++) {
            int curr = list.get(i);
            if (curr == prev + 1) {
                prev = curr;
            } else {
                if (start == prev) {
                    sb.append(start).append(",");
                } else {
                    sb.append(start).append("-").append(prev).append(",");
                }
                start = curr;
                prev = curr;
            }
        }
        if (start == prev) {
            sb.append(start);
        } else {
            sb.append(start).append("-").append(prev);
        }
        return sb.toString();
    }

    private String formatHumanSize(long bytes) {
        if (bytes <= 0)
            return "0 B";
        String[] units = { "B", "KB", "MB", "GB", "TB" };
        int digitGroups = (int) (Math.log10(bytes) / Math.log10(1024));
        return String.format(Locale.US, "%.1f %s", bytes / Math.pow(1024, digitGroups), units[digitGroups]);
    }

    private void cleanupChunkDir(String sessionId) {
        Path chunkDir = uploadBaseDir.resolve("chunks").resolve(sessionId);
        try {
            if (Files.exists(chunkDir)) {
                try (var stream = Files.walk(chunkDir)) {
                    stream.sorted(Comparator.reverseOrder())
                            .map(Path::toFile)
                            .forEach(java.io.File::delete);
                }
            }
        } catch (IOException ignored) {
        }
    }
}
