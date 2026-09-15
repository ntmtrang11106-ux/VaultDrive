package com.example.vault_drive.service;

import com.example.vault_drive.dto.ShareRequest;
import com.example.vault_drive.dto.ShareResponse;
import com.example.vault_drive.dto.UpdatePermissionRequest;
import com.example.vault_drive.entity.*;
import com.example.vault_drive.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ShareService {

    private final FileShareRepository fileShareRepository;
    private final FileItemRepository fileItemRepository;
    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final AccessControlService accessControlService;

    public ShareService(FileShareRepository fileShareRepository,
                        FileItemRepository fileItemRepository,
                        FolderRepository folderRepository,
                        UserRepository userRepository,
                        NotificationRepository notificationRepository,
                        AccessControlService accessControlService) {
        this.fileShareRepository = fileShareRepository;
        this.fileItemRepository = fileItemRepository;
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.accessControlService = accessControlService;
    }

    @Transactional
    public ShareResponse shareItem(User currentUser, ShareRequest request) {
        boolean hasFile = (request.getFileId() != null);
        boolean hasFolder = (request.getFolderId() != null);

        if ((hasFile && hasFolder) || (!hasFile && !hasFolder)) {
            throw new RuntimeException("Yêu cầu chia sẻ phải trỏ tới chính xác 1 file HOẶC 1 folder!");
        }

        User recipient = userRepository.findByEmail(request.getRecipientEmail())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng với email: " + request.getRecipientEmail()));

        if (recipient.getId().equals(currentUser.getId())) {
            throw new RuntimeException("Bạn không thể chia sẻ dữ liệu với chính mình!");
        }

        FileShare.Permission targetPermission;
        try {
            targetPermission = FileShare.Permission.valueOf(request.getPermission().toUpperCase());
        } catch (Exception e) {
            throw new RuntimeException("Quyền chia sẻ không hợp lệ (chấp nhận VIEW hoặc EDIT)!");
        }

        FileItem fileItem = null;
        Folder folderItem = null;
        String itemName = "";

        if (hasFile) {
            fileItem = fileItemRepository.findByIdAndIsDeletedFalse(request.getFileId())
                    .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

            if (fileItem.getIsTrashed()) {
                throw new RuntimeException("Không thể chia sẻ file đang nằm trong thùng rác!");
            }

            if (!accessControlService.hasFileAccess(currentUser, fileItem, "EDIT")) {
                throw new RuntimeException("Bạn không có quyền chia sẻ file này!");
            }
            itemName = fileItem.getFileName();
        } else {
            folderItem = folderRepository.findByIdAndIsDeletedFalse(request.getFolderId())
                    .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

            if (folderItem.getIsTrashed()) {
                throw new RuntimeException("Không thể chia sẻ folder đang nằm trong thùng rác!");
            }

            if (!accessControlService.hasFolderAccess(currentUser, folderItem, "EDIT")) {
                throw new RuntimeException("Bạn không có quyền chia sẻ folder này!");
            }
            itemName = folderItem.getName();
        }

        // Check if existing share record exists
        FileShare share;
        if (hasFile) {
            Optional<FileShare> existing = fileShareRepository.findByFileAndSharedToAndIsDeletedFalse(fileItem, recipient);
            if (existing.isPresent()) {
                share = existing.get();
                share.setPermission(targetPermission);
            } else {
                share = new FileShare(fileItem, null, currentUser, recipient, targetPermission);
            }
        } else {
            Optional<FileShare> existing = fileShareRepository.findByFolderAndSharedToAndIsDeletedFalse(folderItem, recipient);
            if (existing.isPresent()) {
                share = existing.get();
                share.setPermission(targetPermission);
            } else {
                share = new FileShare(null, folderItem, currentUser, recipient, targetPermission);
            }
        }

        FileShare savedShare = fileShareRepository.save(share);

        // Send notification to recipient
        String title = "Bạn nhận được dữ liệu được chia sẻ";
        String content = currentUser.getEmail() + " đã chia sẻ " + (hasFolder ? "thư mục '" : "file '") + itemName + "' cho bạn với quyền " + targetPermission.name() + ".";
        Notification notification = new Notification(
                recipient,
                currentUser,
                title,
                content,
                Notification.Type.SHARE_FILE
        );
        notificationRepository.save(notification);

        return new ShareResponse(savedShare);
    }

    @Transactional(readOnly = true)
    public List<ShareResponse> getSharedUsersForItem(User currentUser, Long fileId, Long folderId) {
        if ((fileId != null && folderId != null) || (fileId == null && folderId == null)) {
            throw new RuntimeException("Phải chỉ định fileId hoặc folderId!");
        }

        List<FileShare> shares;
        if (fileId != null) {
            FileItem fileItem = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                    .orElseThrow(() -> new RuntimeException("File không tồn tại!"));
            if (!accessControlService.hasFileAccess(currentUser, fileItem, "VIEW")) {
                throw new RuntimeException("Bạn không có quyền truy cập danh sách chia sẻ của file này!");
            }
            shares = fileShareRepository.findByFileAndIsDeletedFalse(fileItem);
        } else {
            Folder folderItem = folderRepository.findByIdAndIsDeletedFalse(folderId)
                    .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));
            if (!accessControlService.hasFolderAccess(currentUser, folderItem, "VIEW")) {
                throw new RuntimeException("Bạn không có quyền truy cập danh sách chia sẻ của folder này!");
            }
            shares = fileShareRepository.findByFolderAndIsDeletedFalse(folderItem);
        }

        return shares.stream().map(ShareResponse::new).collect(Collectors.toList());
    }

    @Transactional
    public ShareResponse updateSharePermission(User currentUser, Long shareId, UpdatePermissionRequest request) {
        FileShare share = fileShareRepository.findByIdAndIsDeletedFalse(shareId)
                .orElseThrow(() -> new RuntimeException("Bản ghi chia sẻ không tồn tại!"));

        // Check if current user is owner or sharedBy
        boolean isOwner = share.getFile() != null ? accessControlService.isOwner(currentUser, share.getFile()) : accessControlService.isOwner(currentUser, share.getFolder());
        boolean isSharer = share.getSharedBy().getId().equals(currentUser.getId());

        if (!isOwner && !isSharer) {
            throw new RuntimeException("Bạn không có quyền thay đổi quyền truy cập này!");
        }

        try {
            FileShare.Permission perm = FileShare.Permission.valueOf(request.getPermission().toUpperCase());
            share.setPermission(perm);
        } catch (Exception e) {
            throw new RuntimeException("Quyền không hợp lệ!");
        }

        FileShare saved = fileShareRepository.save(share);
        return new ShareResponse(saved);
    }

    @Transactional
    public void revokeShare(User currentUser, Long shareId) {
        FileShare share = fileShareRepository.findByIdAndIsDeletedFalse(shareId)
                .orElseThrow(() -> new RuntimeException("Bản ghi chia sẻ không tồn tại!"));

        boolean isOwner = share.getFile() != null ? accessControlService.isOwner(currentUser, share.getFile()) : accessControlService.isOwner(currentUser, share.getFolder());
        boolean isSharer = share.getSharedBy().getId().equals(currentUser.getId());

        if (!isOwner && !isSharer) {
            throw new RuntimeException("Bạn không có quyền thu hồi chia sẻ này!");
        }

        share.setIsDeleted(true);
        share.setDeletedAt(LocalDateTime.now());
        fileShareRepository.save(share);
    }

    @Transactional(readOnly = true)
    public List<ShareResponse> getSharedWithMe(User currentUser) {
        List<FileShare> shares = fileShareRepository.findBySharedToAndIsDeletedFalse(currentUser);
        return shares.stream()
                .filter(s -> {
                    if (s.getFile() != null) {
                        return !s.getFile().getIsTrashed() && !s.getFile().getIsDeleted();
                    }
                    if (s.getFolder() != null) {
                        return !s.getFolder().getIsTrashed() && !s.getFolder().getIsDeleted();
                    }
                    return false;
                })
                .map(ShareResponse::new)
                .collect(Collectors.toList());
    }
}
