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

            // Requirement 4: ONLY owner can manage sharing
            if (!accessControlService.canManageSharing(currentUser, fileItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền chia sẻ file này!");
            }
            itemName = fileItem.getFileName();
        } else {
            folderItem = folderRepository.findByIdAndIsDeletedFalse(request.getFolderId())
                    .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

            if (folderItem.getIsTrashed()) {
                throw new RuntimeException("Không thể chia sẻ folder đang nằm trong thùng rác!");
            }

            // Requirement 4: ONLY owner can manage sharing
            if (!accessControlService.canManageSharing(currentUser, folderItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền chia sẻ folder này!");
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

        // Requirement 6: Create notification for recipient
        String senderDisplayName = currentUser.getFullName() != null && !currentUser.getFullName().isBlank() ? currentUser.getFullName() : currentUser.getEmail();
        String title = hasFolder ? "New shared folder" : "New shared file";
        String content = senderDisplayName + " shared " + itemName + " with you";
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
            if (!accessControlService.canManageSharing(currentUser, fileItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền xem danh sách chia sẻ!");
            }
            shares = fileShareRepository.findByFileAndIsDeletedFalse(fileItem);
        } else {
            Folder folderItem = folderRepository.findByIdAndIsDeletedFalse(folderId)
                    .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));
            if (!accessControlService.canManageSharing(currentUser, folderItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền xem danh sách chia sẻ!");
            }
            shares = fileShareRepository.findByFolderAndIsDeletedFalse(folderItem);
        }

        return shares.stream().map(ShareResponse::new).collect(Collectors.toList());
    }

    @Transactional
    public ShareResponse updateSharePermission(User currentUser, Long shareId, UpdatePermissionRequest request) {
        FileShare share = fileShareRepository.findByIdAndIsDeletedFalse(shareId)
                .orElseThrow(() -> new RuntimeException("Bản ghi chia sẻ không tồn tại!"));

        boolean isOwner = share.getFile() != null ? accessControlService.canManageSharing(currentUser, share.getFile()) : accessControlService.canManageSharing(currentUser, share.getFolder());

        if (!isOwner) {
            throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền thay đổi quyền truy cập chia sẻ!");
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

        boolean isOwner = share.getFile() != null ? accessControlService.canManageSharing(currentUser, share.getFile()) : accessControlService.canManageSharing(currentUser, share.getFolder());

        if (!isOwner) {
            throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền thu hồi chia sẻ này!");
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
                        return !Boolean.TRUE.equals(s.getFile().getIsTrashed()) && !Boolean.TRUE.equals(s.getFile().getIsDeleted());
                    }
                    if (s.getFolder() != null) {
                        return !Boolean.TRUE.equals(s.getFolder().getIsTrashed()) && !Boolean.TRUE.equals(s.getFolder().getIsDeleted());
                    }
                    return false;
                })
                .map(ShareResponse::new)
                .collect(Collectors.toList());
    }
}
