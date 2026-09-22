package com.example.vault_drive.service;

import com.example.vault_drive.dto.*;
import com.example.vault_drive.entity.*;
import com.example.vault_drive.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private final FolderRepository folderRepository;
    private final FileItemRepository fileItemRepository;
    private final UserStorageRepository userStorageRepository;
    private final StoragePlanRepository storagePlanRepository;
    private final FileShareRepository fileShareRepository;
    private final AccessControlService accessControlService;

    public DashboardService(FolderRepository folderRepository,
                            FileItemRepository fileItemRepository,
                            UserStorageRepository userStorageRepository,
                            StoragePlanRepository storagePlanRepository,
                            FileShareRepository fileShareRepository,
                            AccessControlService accessControlService) {
        this.folderRepository = folderRepository;
        this.fileItemRepository = fileItemRepository;
        this.userStorageRepository = userStorageRepository;
        this.storagePlanRepository = storagePlanRepository;
        this.fileShareRepository = fileShareRepository;
        this.accessControlService = accessControlService;
    }

    @Transactional(readOnly = true)
    public StorageInfoResponse getStorageInfo(User user) {
        UserStorage userStorage = userStorageRepository.findByUser(user)
                .orElseGet(() -> {
                    StoragePlan defaultPlan = storagePlanRepository.findByName("Gói Miễn Phí")
                            .orElseGet(() -> storagePlanRepository.findByName("Free Plan")
                                    .orElseGet(() -> storagePlanRepository.save(
                                            new StoragePlan("Gói Miễn Phí", 10L * 1024 * 1024 * 1024, 0.0)
                                    )));
                    return userStorageRepository.save(new UserStorage(user, defaultPlan, 0L));
                });

        return new StorageInfoResponse(userStorage.getUsedBytes(), userStorage.getPlan().getMaxBytes());
    }

    @Transactional(readOnly = true)
    public DashboardResponse getRootDashboard(User user) {
        // Own root folders & files
        List<Folder> ownFolders = folderRepository.findByUserAndParentIsNullAndIsTrashedFalseAndIsDeletedFalse(user);
        List<FileItem> ownFiles = fileItemRepository.findByUserAndFolderIsNullAndIsTrashedFalseAndIsDeletedFalse(user);

        List<FolderResponse> folderResponses = ownFolders.stream()
                .map(f -> new FolderResponse(f, false, "OWNER"))
                .collect(Collectors.toList());

        List<FileItemResponse> fileResponses = ownFiles.stream()
                .map(f -> new FileItemResponse(f, false, "OWNER"))
                .collect(Collectors.toList());

        // Add shared root items (shares directly pointing to item where item parent/folder is null)
        List<FileShare> shares = fileShareRepository.findBySharedToAndIsDeletedFalse(user);
        for (FileShare share : shares) {
            if (share.getFolder() != null) {
                Folder f = share.getFolder();
                if (!Boolean.TRUE.equals(f.getIsTrashed()) && !Boolean.TRUE.equals(f.getIsDeleted()) && f.getParent() == null && !accessControlService.isOwner(user, f)) {
                    folderResponses.add(new FolderResponse(f, true, share.getPermission().name()));
                }
            } else if (share.getFile() != null) {
                FileItem fi = share.getFile();
                if (!Boolean.TRUE.equals(fi.getIsTrashed()) && !Boolean.TRUE.equals(fi.getIsDeleted()) && fi.getFolder() == null && !accessControlService.isOwner(user, fi)) {
                    fileResponses.add(new FileItemResponse(fi, true, share.getPermission().name()));
                }
            }
        }

        StorageInfoResponse storageInfo = getStorageInfo(user);
        return new DashboardResponse(null, folderResponses, fileResponses, storageInfo);
    }

    @Transactional(readOnly = true)
    public DashboardResponse getFolderDashboard(User user, Long folderId) {
        Folder currentFolder = folderRepository.findByIdAndIsDeletedFalse(folderId)
                .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

        if (Boolean.TRUE.equals(currentFolder.getIsTrashed())) {
            throw new RuntimeException("Folder đã bị chuyển vào thùng rác!");
        }

        if (!accessControlService.hasFolderAccess(user, currentFolder, "VIEW")) {
            throw new RuntimeException("Bạn không có quyền truy cập vào folder này!");
        }

        String currentPerm = accessControlService.getEffectiveFolderPermission(user, currentFolder);

        // Subfolders
        List<Folder> subfolders = folderRepository.findByParentIdAndIsDeletedFalse(folderId);
        List<FolderResponse> folderResponses = subfolders.stream()
                .filter(f -> !Boolean.TRUE.equals(f.getIsTrashed()))
                .map(f -> {
                    boolean isShared = !accessControlService.isOwner(user, f);
                    String perm = accessControlService.getEffectiveFolderPermission(user, f);
                    return new FolderResponse(f, isShared, perm);
                })
                .collect(Collectors.toList());

        // Files in folder
        List<FileItem> files = fileItemRepository.findByFolderIdAndIsDeletedFalse(folderId);
        List<FileItemResponse> fileResponses = files.stream()
                .filter(f -> !Boolean.TRUE.equals(f.getIsTrashed()))
                .map(f -> {
                    boolean isShared = !accessControlService.isOwner(user, f);
                    String perm = accessControlService.getEffectiveFilePermission(user, f);
                    return new FileItemResponse(f, isShared, perm);
                })
                .collect(Collectors.toList());

        FolderResponse currentFolderResponse = new FolderResponse(currentFolder, !accessControlService.isOwner(user, currentFolder), currentPerm);
        StorageInfoResponse storageInfo = getStorageInfo(user);

        return new DashboardResponse(currentFolderResponse, folderResponses, fileResponses, storageInfo);
    }

    @Transactional(readOnly = true)
    public List<FolderTreeResponse> getFolderTree(User user) {
        List<Folder> allUserFolders = folderRepository.findByUserAndIsTrashedFalseAndIsDeletedFalse(user);
        
        List<Folder> rootFolders = allUserFolders.stream()
                .filter(f -> f.getParent() == null)
                .collect(Collectors.toList());

        return rootFolders.stream()
                .map(f -> buildTree(f, allUserFolders))
                .collect(Collectors.toList());
    }

    private FolderTreeResponse buildTree(Folder folder, List<Folder> allFolders) {
        FolderTreeResponse node = new FolderTreeResponse(
                folder.getId(),
                folder.getName(),
                folder.getParent() != null ? folder.getParent().getId() : null
        );

        List<FolderTreeResponse> children = allFolders.stream()
                .filter(f -> f.getParent() != null && f.getParent().getId().equals(folder.getId()))
                .map(f -> buildTree(f, allFolders))
                .collect(Collectors.toList());

        node.setChildren(children);
        return node;
    }

    @Transactional
    public FolderResponse createFolder(User user, FolderCreateRequest request) {
        Folder parentFolder = null;
        if (request.getParentId() != null) {
            parentFolder = folderRepository.findByIdAndIsDeletedFalse(request.getParentId())
                    .orElseThrow(() -> new RuntimeException("Folder cha không tồn tại!"));

            if (Boolean.TRUE.equals(parentFolder.getIsTrashed())) {
                throw new RuntimeException("Không thể tạo folder trong thư mục rác!");
            }

            if (!accessControlService.hasFolderAccess(user, parentFolder, "EDIT")) {
                throw new RuntimeException("Bạn không có quyền chỉnh sửa/tạo folder trong thư mục này!");
            }
        }

        Folder folder = new Folder(request.getName(), parentFolder, user);
        Folder savedFolder = folderRepository.save(folder);

        String perm = accessControlService.getEffectiveFolderPermission(user, savedFolder);
        boolean isShared = !accessControlService.isOwner(user, savedFolder);

        return new FolderResponse(savedFolder, isShared, perm);
    }

    @Transactional
    public FolderResponse renameFolder(User user, Long folderId, RenameRequest request) {
        if (request.getNewName() == null || request.getNewName().isBlank()) {
            throw new RuntimeException("Tên thư mục mới không được để trống!");
        }

        Folder folder = folderRepository.findByIdAndIsDeletedFalse(folderId)
                .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

        if (Boolean.TRUE.equals(folder.getIsTrashed())) {
            throw new RuntimeException("Không thể đổi tên thư mục đang ở trong thùng rác!");
        }

        if (!accessControlService.hasFolderAccess(user, folder, "EDIT")) {
            throw new RuntimeException("Bạn không có quyền đổi tên thư mục này!");
        }

        folder.setName(request.getNewName());
        Folder saved = folderRepository.save(folder);

        String perm = accessControlService.getEffectiveFolderPermission(user, saved);
        boolean isShared = !accessControlService.isOwner(user, saved);
        return new FolderResponse(saved, isShared, perm);
    }

    @Transactional
    public FolderResponse moveFolder(User user, Long folderId, MoveRequest request) {
        Folder folder = folderRepository.findByIdAndIsDeletedFalse(folderId)
                .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

        if (Boolean.TRUE.equals(folder.getIsTrashed())) {
            throw new RuntimeException("Không thể di chuyển thư mục đang ở trong thùng rác!");
        }

        if (!accessControlService.hasFolderAccess(user, folder, "EDIT")) {
            throw new RuntimeException("Bạn không có quyền di chuyển thư mục này!");
        }

        Folder targetFolder = null;
        if (request.getTargetFolderId() != null) {
            if (request.getTargetFolderId().equals(folderId)) {
                throw new RuntimeException("Không thể di chuyển thư mục vào chính nó!");
            }

            targetFolder = folderRepository.findByIdAndIsDeletedFalse(request.getTargetFolderId())
                    .orElseThrow(() -> new RuntimeException("Thư mục đích không tồn tại!"));

            if (Boolean.TRUE.equals(targetFolder.getIsTrashed())) {
                throw new RuntimeException("Không thể di chuyển thư mục vào thư mục rác!");
            }

            if (!accessControlService.hasFolderAccess(user, targetFolder, "EDIT")) {
                throw new RuntimeException("Bạn không có quyền di chuyển vào thư mục đích này!");
            }

            // Prevent moving folder into any of its own subfolders
            if (isSubfolderOf(targetFolder, folder)) {
                throw new RuntimeException("Không thể di chuyển thư mục vào thư mục con của chính nó!");
            }
        }

        folder.setParent(targetFolder);
        Folder saved = folderRepository.save(folder);

        String perm = accessControlService.getEffectiveFolderPermission(user, saved);
        boolean isShared = !accessControlService.isOwner(user, saved);
        return new FolderResponse(saved, isShared, perm);
    }

    private boolean isSubfolderOf(Folder potentialChild, Folder parent) {
        if (potentialChild == null || parent == null) return false;
        if (potentialChild.getId().equals(parent.getId())) return true;
        if (potentialChild.getParent() == null) return false;
        return isSubfolderOf(potentialChild.getParent(), parent);
    }
}
