package com.example.vault_drive.dto;

import com.example.vault_drive.entity.ShareLink;

import java.time.LocalDateTime;

public class ShareLinkResponse {
    private Long id;
    private Long fileId;
    private String fileName;
    private Long folderId;
    private String folderName;
    private String token;
    private String publicUrl;
    private LocalDateTime expiresAt;
    private Boolean isActive;
    private LocalDateTime createdAt;

    public ShareLinkResponse() {}

    public ShareLinkResponse(ShareLink shareLink, String baseUrl) {
        this.id = shareLink.getId();
        if (shareLink.getFile() != null) {
            this.fileId = shareLink.getFile().getId();
            this.fileName = shareLink.getFile().getFileName();
        }
        if (shareLink.getFolder() != null) {
            this.folderId = shareLink.getFolder().getId();
            this.folderName = shareLink.getFolder().getName();
        }
        this.token = shareLink.getToken();
        this.publicUrl = baseUrl + "/api/public/share-links/" + shareLink.getToken();
        this.expiresAt = shareLink.getExpiresAt();
        this.isActive = shareLink.getIsActive();
        this.createdAt = shareLink.getCreatedAt();
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

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPublicUrl() { return publicUrl; }
    public void setPublicUrl(String publicUrl) { this.publicUrl = publicUrl; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
