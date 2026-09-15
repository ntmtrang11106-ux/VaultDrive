package com.example.vault_drive.dto;

import com.example.vault_drive.entity.FileItem;

import java.time.LocalDateTime;

public class FileItemResponse {
    private Long id;
    private String fileName;
    private String originalName;
    private String fileType;
    private Long sizeBytes;
    private String filePath;
    private Long folderId;
    private Long userId;
    private String userEmail;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean isShared;
    private String permission;

    public FileItemResponse() {}

    public FileItemResponse(FileItem file, boolean isShared, String permission) {
        this.id = file.getId();
        this.fileName = file.getFileName();
        this.originalName = file.getOriginalName();
        this.fileType = file.getFileType();
        this.sizeBytes = file.getSizeBytes();
        this.filePath = file.getFilePath();
        this.folderId = file.getFolder() != null ? file.getFolder().getId() : null;
        if (file.getUser() != null) {
            this.userId = file.getUser().getId();
            this.userEmail = file.getUser().getEmail();
        }
        this.createdAt = file.getCreatedAt();
        this.updatedAt = file.getUpdatedAt();
        this.isShared = isShared;
        this.permission = permission != null ? permission : "OWNER";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Long sizeBytes) { this.sizeBytes = sizeBytes; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public boolean isShared() { return isShared; }
    public void setShared(boolean shared) { isShared = shared; }

    public String getPermission() { return permission; }
    public void setPermission(String permission) { this.permission = permission; }
}
