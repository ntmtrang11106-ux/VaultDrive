package com.example.vault_drive.service;

import com.example.vault_drive.dto.*;
import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.ShareLink;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.FileItemRepository;
import com.example.vault_drive.repository.FolderRepository;
import com.example.vault_drive.repository.ShareLinkRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ShareLinkService {

    private final ShareLinkRepository shareLinkRepository;
    private final FileItemRepository fileItemRepository;
    private final FolderRepository folderRepository;
    private final AccessControlService accessControlService;

    @Value("${app.base-url:http://localhost:8080}")
    private String baseUrl;

    public ShareLinkService(ShareLinkRepository shareLinkRepository,
                            FileItemRepository fileItemRepository,
                            FolderRepository folderRepository,
                            AccessControlService accessControlService) {
        this.shareLinkRepository = shareLinkRepository;
        this.fileItemRepository = fileItemRepository;
        this.folderRepository = folderRepository;
        this.accessControlService = accessControlService;
    }

    @Transactional
    public ShareLinkResponse createShareLink(User currentUser, ShareLinkCreateRequest request) {
        boolean hasFile = (request.getFileId() != null);
        boolean hasFolder = (request.getFolderId() != null);

        if ((hasFile && hasFolder) || (!hasFile && !hasFolder)) {
            throw new RuntimeException("Yêu cầu tạo liên kết chia sẻ phải trỏ tới chính xác 1 file HOẶC 1 folder!");
        }

        FileItem fileItem = null;
        Folder folderItem = null;

        if (hasFile) {
            fileItem = fileItemRepository.findByIdAndIsDeletedFalse(request.getFileId())
                    .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

            if (Boolean.TRUE.equals(fileItem.getIsTrashed())) {
                throw new RuntimeException("Không thể tạo link chia sẻ cho file trong thùng rác!");
            }

            if (!accessControlService.canManageSharing(currentUser, fileItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền tạo link chia sẻ công khai cho file này!");
            }
        } else {
            folderItem = folderRepository.findByIdAndIsDeletedFalse(request.getFolderId())
                    .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

            if (Boolean.TRUE.equals(folderItem.getIsTrashed())) {
                throw new RuntimeException("Không thể tạo link chia sẻ cho folder trong thùng rác!");
            }

            if (!accessControlService.canManageSharing(currentUser, folderItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền tạo link chia sẻ công khai cho folder này!");
            }
        }

        String token = UUID.randomUUID().toString();
        ShareLink shareLink = new ShareLink(fileItem, folderItem, token, currentUser, request.getExpiresAt());
        ShareLink saved = shareLinkRepository.save(shareLink);

        return new ShareLinkResponse(saved, baseUrl);
    }

    @Transactional(readOnly = true)
    public List<ShareLinkResponse> getShareLinksForResource(User currentUser, Long fileId, Long folderId) {
        if ((fileId != null && folderId != null) || (fileId == null && folderId == null)) {
            throw new RuntimeException("Phải chỉ định fileId hoặc folderId!");
        }

        List<ShareLink> links;
        if (fileId != null) {
            FileItem fileItem = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                    .orElseThrow(() -> new RuntimeException("File không tồn tại!"));
            if (!accessControlService.canManageSharing(currentUser, fileItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền xem danh sách link chia sẻ!");
            }
            links = shareLinkRepository.findByFile(fileItem);
        } else {
            Folder folderItem = folderRepository.findByIdAndIsDeletedFalse(folderId)
                    .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));
            if (!accessControlService.canManageSharing(currentUser, folderItem)) {
                throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền xem danh sách link chia sẻ!");
            }
            links = shareLinkRepository.findByFolder(folderItem);
        }

        return links.stream()
                .filter(l -> Boolean.TRUE.equals(l.getIsActive()))
                .map(l -> new ShareLinkResponse(l, baseUrl))
                .collect(Collectors.toList());
    }

    @Transactional
    public void deactivateShareLink(User currentUser, Long linkId) {
        ShareLink shareLink = shareLinkRepository.findById(linkId)
                .orElseThrow(() -> new RuntimeException("Link chia sẻ không tồn tại!"));

        boolean isOwner = shareLink.getFile() != null ? accessControlService.canManageSharing(currentUser, shareLink.getFile()) : accessControlService.canManageSharing(currentUser, shareLink.getFolder());

        if (!isOwner) {
            throw new RuntimeException("Chỉ chủ sở hữu (Owner) mới có quyền thu hồi / vô hiệu hóa link chia sẻ này!");
        }

        shareLink.setIsActive(false);
        shareLinkRepository.save(shareLink);
    }

    /**
     * Requirement 9: Access public link
     * Validates: 1. token exists? 2. is_active? 3. not expired? 4. resource exists & not trashed/deleted?
     * Returns metadata for VIEW ONLY.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getPublicLinkDetails(String token, Long subFolderId) {
        ShareLink shareLink = validatePublicToken(token);

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("expiresAt", shareLink.getExpiresAt());
        result.put("permission", "VIEW"); // Public link is strictly VIEW ONLY

        if (shareLink.getFile() != null) {
            FileItem file = shareLink.getFile();
            result.put("type", "FILE");
            result.put("file", new FileItemResponse(file, true, "VIEW"));
        } else {
            Folder rootShareFolder = shareLink.getFolder();
            Folder currentFolder = rootShareFolder;

            if (subFolderId != null && !subFolderId.equals(rootShareFolder.getId())) {
                Folder requestedSubFolder = folderRepository.findByIdAndIsDeletedFalse(subFolderId)
                        .orElseThrow(() -> new RuntimeException("Folder không tồn tại!"));

                // Verify requested subFolder is descendant of rootShareFolder
                if (!isDescendantOf(requestedSubFolder, rootShareFolder)) {
                    throw new RuntimeException("Không có quyền truy cập vào folder này thông qua link chia sẻ!");
                }
                currentFolder = requestedSubFolder;
            }

            if (Boolean.TRUE.equals(currentFolder.getIsTrashed()) || Boolean.TRUE.equals(currentFolder.getIsDeleted())) {
                throw new RuntimeException("Thư mục đã bị xóa hoặc chuyển vào thùng rác!");
            }

            result.put("type", "FOLDER");
            result.put("rootFolderId", rootShareFolder.getId());

            FolderResponse currentFolderResponse = new FolderResponse(currentFolder, true, "VIEW");

            // List subfolders
            List<Folder> subfolders = folderRepository.findByParentIdAndIsDeletedFalse(currentFolder.getId());
            List<FolderResponse> folderResponses = subfolders.stream()
                    .filter(f -> !Boolean.TRUE.equals(f.getIsTrashed()))
                    .map(f -> new FolderResponse(f, true, "VIEW"))
                    .collect(Collectors.toList());

            // List files
            List<FileItem> files = fileItemRepository.findByFolderIdAndIsDeletedFalse(currentFolder.getId());
            List<FileItemResponse> fileResponses = files.stream()
                    .filter(f -> !Boolean.TRUE.equals(f.getIsTrashed()))
                    .map(f -> new FileItemResponse(f, true, "VIEW"))
                    .collect(Collectors.toList());

            result.put("currentFolder", currentFolderResponse);
            result.put("folders", folderResponses);
            result.put("files", fileResponses);
        }

        return result;
    }

    @Transactional(readOnly = true)
    public FileItem getPublicFileForPreviewOrDownload(String token, Long fileId) {
        ShareLink shareLink = validatePublicToken(token);

        if (shareLink.getFile() != null) {
            FileItem file = shareLink.getFile();
            if (fileId != null && !file.getId().equals(fileId)) {
                throw new RuntimeException("File không khớp với link chia sẻ!");
            }
            return file;
        } else {
            if (fileId == null) {
                throw new RuntimeException("Vui lòng chỉ định fileId cần tải / xem!");
            }
            FileItem file = fileItemRepository.findByIdAndIsDeletedFalse(fileId)
                    .orElseThrow(() -> new RuntimeException("File không tồn tại!"));

            if (Boolean.TRUE.equals(file.getIsTrashed()) || Boolean.TRUE.equals(file.getIsDeleted())) {
                throw new RuntimeException("File đã bị xóa hoặc trong thùng rác!");
            }

            if (file.getFolder() == null || !isDescendantOf(file.getFolder(), shareLink.getFolder())) {
                throw new RuntimeException("File không thuộc thư mục được chia sẻ!");
            }

            return file;
        }
    }

    private ShareLink validatePublicToken(String token) {
        ShareLink shareLink = shareLinkRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Link chia sẻ không hợp lệ hoặc không tồn tại!"));

        if (!Boolean.TRUE.equals(shareLink.getIsActive())) {
            throw new RuntimeException("Link chia sẻ này đã bị vô hiệu hóa!");
        }

        if (shareLink.getExpiresAt() != null && LocalDateTime.now().isAfter(shareLink.getExpiresAt())) {
            throw new RuntimeException("Link chia sẻ này đã hết hạn truy cập!");
        }

        if (shareLink.getFile() != null) {
            FileItem file = shareLink.getFile();
            if (Boolean.TRUE.equals(file.getIsTrashed()) || Boolean.TRUE.equals(file.getIsDeleted())) {
                throw new RuntimeException("Tài nguyên đã bị xóa hoặc chuyển vào thùng rác!");
            }
        } else if (shareLink.getFolder() != null) {
            Folder folder = shareLink.getFolder();
            if (Boolean.TRUE.equals(folder.getIsTrashed()) || Boolean.TRUE.equals(folder.getIsDeleted())) {
                throw new RuntimeException("Tài nguyên đã bị xóa hoặc chuyển vào thùng rác!");
            }
        } else {
            throw new RuntimeException("Dữ liệu liên kết không hợp lệ!");
        }

        return shareLink;
    }

    private boolean isDescendantOf(Folder folder, Folder targetAncestor) {
        if (folder == null || targetAncestor == null) return false;
        if (folder.getId().equals(targetAncestor.getId())) return true;
        if (folder.getParent() == null) return false;
        return isDescendantOf(folder.getParent(), targetAncestor);
    }
}
