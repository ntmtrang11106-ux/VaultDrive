package com.example.vault_drive.service;

import com.example.vault_drive.dto.FileItemResponse;
import com.example.vault_drive.dto.FolderResponse;
import com.example.vault_drive.dto.MoveRequest;
import com.example.vault_drive.dto.RenameRequest;
import com.example.vault_drive.dto.SearchResponse;
import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.FileShare;
import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.FileItemRepository;
import com.example.vault_drive.repository.FileShareRepository;
import com.example.vault_drive.repository.FolderRepository;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.*;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class FileService {

    private final Path uploadDir = Paths.get("uploads");
    private final FileItemRepository fileItemRepository;
    private final FolderRepository folderRepository;
    private final FileShareRepository fileShareRepository;
    private final AccessControlService accessControlService;

    public FileService(FileItemRepository fileItemRepository,
                       FolderRepository folderRepository,
                       FileShareRepository fileShareRepository,
                       AccessControlService accessControlService) {
        this.fileItemRepository = fileItemRepository;
        this.folderRepository = folderRepository;
        this.fileShareRepository = fileShareRepository;
        this.accessControlService = accessControlService;
    }

    @Async("fileExecutor")
    public CompletableFuture<Boolean> mergeChunksAsync(String fileName, int totalChunks) {
        try {
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }
            Path destFile = uploadDir.resolve(fileName);
            
            // Mở FileChannel ghi file đích
            try (FileChannel destChannel = FileChannel.open(destFile, StandardOpenOption.CREATE, StandardOpenOption.WRITE)) {
                
                // Khóa file cấp OS tránh ghi chồng / Race Condition
                try (FileLock lock = destChannel.lock()) {
                    for (int i = 0; i < totalChunks; i++) {
                        Path chunkPath = uploadDir.resolve(fileName + ".part" + i);
                        if (Files.exists(chunkPath)) {
                            try (FileChannel srcChannel = FileChannel.open(chunkPath, StandardOpenOption.READ)) {
                                srcChannel.transferTo(0, srcChannel.size(), destChannel);
                            }
                            Files.deleteIfExists(chunkPath); // Dọn dẹp chunk sau khi ghép
                        }
                    }
                }
                return CompletableFuture.completedFuture(true);
            }
        } catch (IOException e) {
            e.printStackTrace();
            return CompletableFuture.completedFuture(false);
        }
    }

    @Transactional(readOnly = true)
    public FileItem getFileForPreview(User user, Long fileId) {
        FileItem fileItem = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

        if (Boolean.TRUE.equals(fileItem.getIsTrashed())) {
            throw new RuntimeException("File đang ở trong thùng rác, không thể xem trước!");
        }

        if (!accessControlService.hasFileAccess(user, fileItem, "VIEW")) {
            throw new RuntimeException("Bạn không có quyền xem trước file này!");
        }

        return fileItem;
    }

    @Transactional(readOnly = true)
    public FileItem getFileForDownload(User user, Long fileId) {
        FileItem fileItem = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

        if (Boolean.TRUE.equals(fileItem.getIsTrashed())) {
            throw new RuntimeException("File đang ở trong thùng rác, không thể tải về!");
        }

        if (!accessControlService.hasFileAccess(user, fileItem, "VIEW")) {
            throw new RuntimeException("Bạn không có quyền tải file này!");
        }

        return fileItem;
    }

    @Transactional
    public FileItemResponse renameFile(User user, Long fileId, RenameRequest request) {
        if (request.getNewName() == null || request.getNewName().isBlank()) {
            throw new RuntimeException("Tên file mới không được để trống!");
        }

        FileItem fileItem = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

        if (Boolean.TRUE.equals(fileItem.getIsTrashed())) {
            throw new RuntimeException("Không thể đổi tên file đang nằm trong thùng rác!");
        }

        if (!accessControlService.hasFileAccess(user, fileItem, "EDIT")) {
            throw new RuntimeException("Bạn không có quyền đổi tên file này!");
        }

        fileItem.setFileName(request.getNewName());
        FileItem saved = fileItemRepository.save(fileItem);

        String perm = accessControlService.getEffectiveFilePermission(user, saved);
        boolean isShared = !accessControlService.isOwner(user, saved);
        return new FileItemResponse(saved, isShared, perm);
    }

    @Transactional
    public FileItemResponse moveFile(User user, Long fileId, MoveRequest request) {
        FileItem fileItem = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

        if (Boolean.TRUE.equals(fileItem.getIsTrashed())) {
            throw new RuntimeException("Không thể di chuyển file đang nằm trong thùng rác!");
        }

        if (!accessControlService.hasFileAccess(user, fileItem, "EDIT")) {
            throw new RuntimeException("Bạn không có quyền di chuyển file này!");
        }

        Folder targetFolder = null;
        if (request.getTargetFolderId() != null) {
            targetFolder = folderRepository.findByIdAndIsDeletedFalse(request.getTargetFolderId())
                    .orElseThrow(() -> new RuntimeException("Thư mục đích không tồn tại!"));

            if (Boolean.TRUE.equals(targetFolder.getIsTrashed())) {
                throw new RuntimeException("Không thể di chuyển file vào thư mục rác!");
            }

            if (!accessControlService.hasFolderAccess(user, targetFolder, "EDIT")) {
                throw new RuntimeException("Bạn không có quyền di chuyển file vào thư mục đích này!");
            }
        }

        fileItem.setFolder(targetFolder);
        FileItem saved = fileItemRepository.save(fileItem);

        String perm = accessControlService.getEffectiveFilePermission(user, saved);
        boolean isShared = !accessControlService.isOwner(user, saved);
        return new FileItemResponse(saved, isShared, perm);
    }

    @Transactional(readOnly = true)
    public SearchResponse search(User user, String query) {
        if (query == null || query.isBlank()) {
            return new SearchResponse(Collections.emptyList(), Collections.emptyList());
        }
        String cleanQuery = query.trim();

        // 1. Tìm thư mục thuộc quyền sở hữu
        List<Folder> ownFolders = folderRepository.findByUserAndNameContainingIgnoreCaseAndIsTrashedFalseAndIsDeletedFalse(user, cleanQuery);
        List<FolderResponse> folderResponses = ownFolders.stream()
                .map(f -> new FolderResponse(f, false, "OWNER"))
                .collect(Collectors.toList());

        // 2. Tìm tệp tin thuộc quyền sở hữu
        List<FileItem> ownFiles = fileItemRepository.findByUserAndFileNameContainingIgnoreCaseAndIsTrashedFalseAndIsDeletedFalse(user, cleanQuery);
        List<FileItemResponse> fileResponses = ownFiles.stream()
                .map(f -> new FileItemResponse(f, false, "OWNER"))
                .collect(Collectors.toList());

        // 3. Tìm trong các thư mục và tệp tin được người khác chia sẻ
        List<FileShare> shares = fileShareRepository.findBySharedToAndIsDeletedFalse(user);
        for (FileShare share : shares) {
            if (share.getFolder() != null) {
                Folder f = share.getFolder();
                if (!Boolean.TRUE.equals(f.getIsTrashed()) && !Boolean.TRUE.equals(f.getIsDeleted())
                        && !accessControlService.isOwner(user, f)
                        && f.getName() != null && f.getName().toLowerCase().contains(cleanQuery.toLowerCase())) {
                    boolean alreadyExists = folderResponses.stream().anyMatch(fr -> fr.getId().equals(f.getId()));
                    if (!alreadyExists) {
                        folderResponses.add(new FolderResponse(f, true, share.getPermission().name()));
                    }
                }
            } else if (share.getFile() != null) {
                FileItem fi = share.getFile();
                if (!Boolean.TRUE.equals(fi.getIsTrashed()) && !Boolean.TRUE.equals(fi.getIsDeleted())
                        && !accessControlService.isOwner(user, fi)
                        && fi.getFileName() != null && fi.getFileName().toLowerCase().contains(cleanQuery.toLowerCase())) {
                    boolean alreadyExists = fileResponses.stream().anyMatch(fr -> fr.getId().equals(fi.getId()));
                    if (!alreadyExists) {
                        fileResponses.add(new FileItemResponse(fi, true, share.getPermission().name()));
                    }
                }
            }
        }

        return new SearchResponse(folderResponses, fileResponses);
    }
}
