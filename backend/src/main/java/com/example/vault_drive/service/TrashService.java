package com.example.vault_drive.service;

import com.example.vault_drive.dto.FileItemResponse;
import com.example.vault_drive.dto.FolderResponse;
import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.entity.UserStorage;
import com.example.vault_drive.repository.FileItemRepository;
import com.example.vault_drive.repository.FolderRepository;
import com.example.vault_drive.repository.UserStorageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TrashService {

    private final FolderRepository folderRepository;
    private final FileItemRepository fileItemRepository;
    private final UserStorageRepository userStorageRepository;
    private final AccessControlService accessControlService;

    public TrashService(FolderRepository folderRepository,
                        FileItemRepository fileItemRepository,
                        UserStorageRepository userStorageRepository,
                        AccessControlService accessControlService) {
        this.folderRepository = folderRepository;
        this.fileItemRepository = fileItemRepository;
        this.userStorageRepository = userStorageRepository;
        this.accessControlService = accessControlService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTrashItems(User user) {
        List<Folder> trashedFolders = folderRepository.findByUserAndIsTrashedTrueAndIsDeletedFalse(user);
        List<FileItem> trashedFiles = fileItemRepository.findByUserAndIsTrashedTrueAndIsDeletedFalse(user);

        List<FolderResponse> folderResponses = trashedFolders.stream()
                .map(f -> new FolderResponse(f, false, "OWNER"))
                .collect(Collectors.toList());

        List<FileItemResponse> fileResponses = trashedFiles.stream()
                .map(f -> new FileItemResponse(f, false, "OWNER"))
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("folders", folderResponses);
        result.put("files", fileResponses);
        return result;
    }

    @Transactional
    public void trashFolder(User user, Long folderId) {
        Folder folder = folderRepository.findByIdAndIsDeletedFalse(folderId)
                .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

        if (!accessControlService.isOwner(user, folder)) {
            throw new RuntimeException("Chỉ chủ sở hữu mới có quyền chuyển folder vào thùng rác!");
        }

        folder.setIsTrashed(true);
        folder.setTrashedAt(LocalDateTime.now());
        folderRepository.save(folder);
    }

    @Transactional
    public void restoreFolder(User user, Long folderId) {
        Folder folder = folderRepository.findByIdAndIsDeletedFalse(folderId)
                .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

        if (!accessControlService.isOwner(user, folder)) {
            throw new RuntimeException("Chỉ chủ sở hữu mới có quyền khôi phục folder!");
        }

        folder.setIsTrashed(false);
        folder.setTrashedAt(null);
        folderRepository.save(folder);
    }

    @Transactional
    public void permanentDeleteFolder(User user, Long folderId) {
        Folder folder = folderRepository.findByIdAndIsDeletedFalse(folderId)
                .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

        if (!accessControlService.isOwner(user, folder)) {
            throw new RuntimeException("Chỉ chủ sở hữu mới có quyền xóa vĩnh viễn folder!");
        }

        deleteFolderRecursive(folder, user);
    }

    private void deleteFolderRecursive(Folder folder, User user) {
        // Delete subfolders
        List<Folder> subfolders = folderRepository.findByParentIdAndIsDeletedFalse(folder.getId());
        for (Folder sub : subfolders) {
            deleteFolderRecursive(sub, user);
        }

        // Delete files in folder & update storage
        List<FileItem> files = fileItemRepository.findByFolderIdAndIsDeletedFalse(folder.getId());
        UserStorage userStorage = userStorageRepository.findByUser(user).orElse(null);

        for (FileItem file : files) {
            file.setIsDeleted(true);
            file.setDeletedAt(LocalDateTime.now());
            fileItemRepository.save(file);

            if (userStorage != null && file.getSizeBytes() != null) {
                long currentUsed = userStorage.getUsedBytes();
                userStorage.setUsedBytes(Math.max(0L, currentUsed - file.getSizeBytes()));
            }
        }
        if (userStorage != null) {
            userStorageRepository.save(userStorage);
        }

        folder.setIsDeleted(true);
        folder.setDeletedAt(LocalDateTime.now());
        folderRepository.save(folder);
    }

    @Transactional
    public void trashFile(User user, Long fileId) {
        FileItem file = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

        if (!accessControlService.isOwner(user, file)) {
            throw new RuntimeException("Chỉ chủ sở hữu mới có quyền chuyển file vào thùng rác!");
        }

        file.setIsTrashed(true);
        file.setTrashedAt(LocalDateTime.now());
        fileItemRepository.save(file);
    }

    @Transactional
    public void restoreFile(User user, Long fileId) {
        FileItem file = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

        if (!accessControlService.isOwner(user, file)) {
            throw new RuntimeException("Chỉ chủ sở hữu mới có quyền khôi phục file!");
        }

        file.setIsTrashed(false);
        file.setTrashedAt(null);
        fileItemRepository.save(file);
    }

    @Transactional
    public void permanentDeleteFile(User user, Long fileId) {
        FileItem file = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

        if (!accessControlService.isOwner(user, file)) {
            throw new RuntimeException("Chỉ chủ sở hữu mới có quyền xóa vĩnh viễn file!");
        }

        file.setIsDeleted(true);
        file.setDeletedAt(LocalDateTime.now());
        fileItemRepository.save(file);

        // Adjust user storage accounting
        UserStorage userStorage = userStorageRepository.findByUser(user).orElse(null);
        if (userStorage != null && file.getSizeBytes() != null) {
            long currentUsed = userStorage.getUsedBytes();
            userStorage.setUsedBytes(Math.max(0L, currentUsed - file.getSizeBytes()));
            userStorageRepository.save(userStorage);
        }
    }
}
