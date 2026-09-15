package com.example.vault_drive.dto;

import com.example.vault_drive.entity.FileShare;

import java.time.LocalDateTime;

public class ShareResponse {
    private Long id;
    private Long fileId;
    private String fileName;
    private Long folderId;
    private String folderName;
    private Long sharedByUserId;
    private String sharedByEmail;
    private Long sharedToUserId;
    private String sharedToEmail;
    private String permission;
    private LocalDateTime createdAt;

    public ShareResponse() {}

    public ShareResponse(FileShare share) {
        this.id = share.getId();
        if (share.getFile() != null) {
            this.fileId = share.getFile().getId();
            this.fileName = share.getFile().getFileName();
        }
        if (share.getFolder() != null) {
            this.folderId = share.getFolder().getId();
            this.folderName = share.getFolder().getName();
        }
        if (share.getSharedBy() != null) {
            this.sharedByUserId = share.getSharedBy().getId();
            this.sharedByEmail = share.getSharedBy().getEmail();
        }
        if (share.getSharedTo() != null) {
            this.sharedToUserId = share.getSharedTo().getId();
            this.sharedToEmail = share.getSharedTo().getEmail();
        }
        this.permission = share.getPermission().name();
        this.createdAt = share.getCreatedAt();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getFileId() { return fileId; }
    public void setFileId(Long fileId) { this.fileId = fileId; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public String getFolderName() { return folderName; }
    public void setFolderName(String folderName) { this.folderName = folderName; }

    public Long getSharedByUserId() { return sharedByUserId; }
    public void setSharedByUserId(Long sharedByUserId) { this.sharedByUserId = sharedByUserId; }

    public String getSharedByEmail() { return sharedByEmail; }
    public void setSharedByEmail(String sharedByEmail) { this.sharedByEmail = sharedByEmail; }

    public Long getSharedToUserId() { return sharedToUserId; }
    public void setSharedToUserId(Long sharedToUserId) { this.sharedToUserId = sharedToUserId; }

    public String getSharedToEmail() { return sharedToEmail; }
    public void setSharedToEmail(String sharedToEmail) { this.sharedToEmail = sharedToEmail; }

    public String getPermission() { return permission; }
    public void setPermission(String permission) { this.permission = permission; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
