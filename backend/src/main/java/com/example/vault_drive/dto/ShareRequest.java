package com.example.vault_drive.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class ShareRequest {

    private Long fileId;
    private Long folderId;

    @NotBlank(message = "Recipient email is required")
    @Email(message = "Invalid email format")
    private String recipientEmail;

    @NotBlank(message = "Permission is required")
    private String permission; // "VIEW" or "EDIT"

    public ShareRequest() {}

    public ShareRequest(Long fileId, Long folderId, String recipientEmail, String permission) {
        this.fileId = fileId;
        this.folderId = folderId;
        this.recipientEmail = recipientEmail;
        this.permission = permission;
    }

    public Long getFileId() { return fileId; }
    public void setFileId(Long fileId) { this.fileId = fileId; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }

    public String getPermission() { return permission; }
    public void setPermission(String permission) { this.permission = permission; }
}
