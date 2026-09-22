package com.example.vault_drive.dto;

import java.time.LocalDateTime;

public class ShareLinkCreateRequest {
    private Long fileId;
    private Long folderId;
    private LocalDateTime expiresAt;

    public ShareLinkCreateRequest() {}

    public ShareLinkCreateRequest(Long fileId, Long folderId, LocalDateTime expiresAt) {
        this.fileId = fileId;
        this.folderId = folderId;
        this.expiresAt = expiresAt;
    }

    public Long getFileId() { return fileId; }
    public void setFileId(Long fileId) { this.fileId = fileId; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
