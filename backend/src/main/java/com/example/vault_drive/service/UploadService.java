package com.example.vault_drive.service;

import com.example.vault_drive.dto.*;
import com.example.vault_drive.entity.*;
import com.example.vault_drive.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UploadService {

    private final UploadSessionRepository uploadSessionRepository;
    private final FolderRepository folderRepository;
    private final FileItemRepository fileItemRepository;
    private final UserStorageRepository userStorageRepository;
    private final StoragePlanRepository storagePlanRepository;
    private final NotificationRepository notificationRepository;
    private final AccessControlService accessControlService;

    private final Path uploadBaseDir = Paths.get("uploads");

    public UploadService(UploadSessionRepository uploadSessionRepository,
                         FolderRepository folderRepository,
                         FileItemRepository fileItemRepository,
                         UserStorageRepository userStorageRepository,
                         StoragePlanRepository storagePlanRepository,
                         NotificationRepository notificationRepository,
                         AccessControlService accessControlService) {
        this.uploadSessionRepository = uploadSessionRepository;
        this.folderRepository = folderRepository;
        this.fileItemRepository = fileItemRepository;
        this.userStorageRepository = userStorageRepository;
        this.storagePlanRepository = storagePlanRepository;
        this.notificationRepository = notificationRepository;
        this.accessControlService = accessControlService;
    }

    @Transactional
    public UploadSessionResponse initUploadSession(User user, UploadInitRequest request) {
        Folder targetFolder = null;
        if (request.getTargetFolderId() != null) {
            targetFolder = folderRepository.findByIdAndIsDeletedFalse(request.getTargetFolderId())
                    .orElseThrow(() -> new RuntimeException("Folder lưu trữ không tồn tại!"));

            if (targetFolder.getIsTrashed()) {
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
                                    new StoragePlan("Free Plan", 10L * 1024 * 1024 * 1024, 0.0)
                            ));
                    return userStorageRepository.save(new UserStorage(user, defaultPlan, 0L));
                });

        long maxBytes = userStorage.getPlan().getMaxBytes();
        long projectedUsed = userStorage.getUsedBytes() + request.getTotalSizeBytes();
        if (projectedUsed > maxBytes) {
            throw new RuntimeException("Không thể tạo phiên upload: Dung lượng lưu trữ không đủ!");
        }

        String sessionId = UUID.randomUUID().toString();
        UploadSession session = new UploadSession(
                sessionId,
                user,
                targetFolder,
                request.getFileName(),
                request.getTotalSizeBytes(),
                request.getTotalChunks()
        );

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

    @Transactional
    public UploadSessionResponse uploadChunk(User user, String sessionId, int chunkIndex, MultipartFile chunkFile) {
        UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại hoặc đã bị hủy!"));

        if (!session.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
        }

        if (session.getStatus() == UploadSession.Status.COMPLETED) {
            throw new RuntimeException("Phiên upload đã hoàn tất!");
        }

        if (session.getStatus() == UploadSession.Status.FAILED) {
            throw new RuntimeException("Phiên upload đã thất bại hoặc bị hủy!");
        }

        if (chunkIndex < 0 || chunkIndex >= session.getTotalChunks()) {
            throw new RuntimeException("Chỉ số chunk không hợp lệ!");
        }

        // Save chunk to disk
        Path chunkDir = uploadBaseDir.resolve("chunks").resolve(sessionId);
        try {
            if (!Files.exists(chunkDir)) {
                Files.createDirectories(chunkDir);
            }
            Path chunkPath = chunkDir.resolve("chunk_" + chunkIndex + ".part");
            chunkFile.transferTo(chunkPath.toAbsolutePath().toFile());
        } catch (IOException e) {
            throw new RuntimeException("Lỗi khi ghi chunk file: " + e.getMessage());
        }

        // Parse and update uploaded chunk indices atomically for idempotency
        Set<Integer> uploadedSet = parseIndices(session.getUploadedChunkIndices());
        if (!uploadedSet.contains(chunkIndex)) {
            uploadedSet.add(chunkIndex);
            session.setUploadedChunkIndices(formatIndices(uploadedSet));
            session.setUploadedChunksCount(uploadedSet.size());
            uploadSessionRepository.save(session);
        }

        return new UploadSessionResponse(session);
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

        if (session.getStatus() == UploadSession.Status.PAUSED) {
            session.setStatus(UploadSession.Status.UPLOADING);
            uploadSessionRepository.save(session);
        }

        return getSessionStatus(user, sessionId);
    }

    @Transactional
    public UploadSessionResponse cancelUploadSession(User user, String sessionId) {
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
    }

    @Transactional
    public FileItemResponse completeUploadSession(User user, String sessionId) {
        UploadSession session = uploadSessionRepository.findByIdAndIsDeletedFalse(sessionId)
                .orElseThrow(() -> new RuntimeException("Phiên upload không tồn tại!"));

        if (!session.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền truy cập phiên upload này!");
        }

        Set<Integer> uploadedSet = parseIndices(session.getUploadedChunkIndices());
        if (uploadedSet.size() < session.getTotalChunks()) {
            throw new RuntimeException("Chưa upload đủ tất cả các chunk! Đã upload: " + uploadedSet.size() + "/" + session.getTotalChunks());
        }

        // Quota check before finalizing
        UserStorage userStorage = userStorageRepository.findByUser(session.getUser())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy dung lượng của người dùng!"));

        long maxBytes = userStorage.getPlan().getMaxBytes();
        if (userStorage.getUsedBytes() + session.getTotalSizeBytes() > maxBytes) {
            session.setStatus(UploadSession.Status.FAILED);
            uploadSessionRepository.save(session);
            throw new RuntimeException("Vượt quá hạn ngạch dung lượng lưu trữ!");
        }

        // Merge chunks using FileChannel to handle large files efficiently
        String storedFileName = UUID.randomUUID().toString() + "_" + session.getFileName();
        Path destDir = uploadBaseDir.resolve("files").resolve(session.getUser().getId().toString());
        try {
            Files.createDirectories(destDir);
        } catch (IOException e) {
            throw new RuntimeException("Không thể tạo thư mục lưu trữ file: " + e.getMessage());
        }

        Path destFile = destDir.resolve(storedFileName);
        Path chunkDir = uploadBaseDir.resolve("chunks").resolve(sessionId);

        try (FileChannel destChannel = FileChannel.open(destFile, StandardOpenOption.CREATE, StandardOpenOption.WRITE)) {
            for (int i = 0; i < session.getTotalChunks(); i++) {
                Path chunkPath = chunkDir.resolve("chunk_" + i + ".part");
                if (!Files.exists(chunkPath)) {
                    throw new RuntimeException("Thiếu chunk " + i + " khi tiến hành ghép file!");
                }
                try (FileChannel srcChannel = FileChannel.open(chunkPath, StandardOpenOption.READ)) {
                    srcChannel.transferTo(0, srcChannel.size(), destChannel);
                }
            }
        } catch (IOException e) {
            session.setStatus(UploadSession.Status.FAILED);
            uploadSessionRepository.save(session);
            throw new RuntimeException("Lỗi trong quá trình ghép các chunk: " + e.getMessage());
        }

        // Clean up chunk directory
        cleanupChunkDir(sessionId);

        // Detect mime type
        String fileType = "application/octet-stream";
        try {
            String probed = Files.probeContentType(destFile);
            if (probed != null) fileType = probed;
        } catch (IOException ignored) {}

        // Create FileItem record
        FileItem fileItem = new FileItem(
                session.getFileName(),
                session.getFileName(),
                fileType,
                session.getTotalSizeBytes(),
                destFile.toAbsolutePath().toString(),
                session.getTargetFolder(),
                session.getUser()
        );
        FileItem savedFile = fileItemRepository.save(fileItem);

        // Atomic update of user storage
        userStorage.setUsedBytes(userStorage.getUsedBytes() + session.getTotalSizeBytes());
        userStorageRepository.save(userStorage);

        // Update session status
        session.setStatus(UploadSession.Status.COMPLETED);
        uploadSessionRepository.save(session);

        // Send Notification
        Notification notification = new Notification(
                session.getUser(),
                null,
                "Tải lên hoàn tất",
                "File '" + session.getFileName() + "' đã được tải lên thành công.",
                Notification.Type.UPLOAD_COMPLETE
        );
        notificationRepository.save(notification);

        return new FileItemResponse(savedFile, false, "OWNER");
    }

    private Set<Integer> parseIndices(String indicesStr) {
        if (indicesStr == null || indicesStr.isBlank()) {
            return new HashSet<>();
        }
        return Arrays.stream(indicesStr.split(","))
                .filter(s -> !s.isBlank())
                .map(Integer::parseInt)
                .collect(Collectors.toSet());
    }

    private String formatIndices(Set<Integer> set) {
        return set.stream()
                .sorted()
                .map(Object::toString)
                .collect(Collectors.joining(","));
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
        } catch (IOException ignored) {}
    }
}
