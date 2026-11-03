package com.example.vault_drive.dto;

import com.example.vault_drive.entity.Folder;

import java.time.LocalDateTime;

public class FolderResponse {
    private Long id;
    private String name;
    private Long parentId;
    private Long userId;
    private String userEmail;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean isShared;
    private String permission;

    public FolderResponse() {}

    public FolderResponse(Folder folder, boolean isShared, String permission) {
        this.id = folder.getId();
        this.name = folder.getName();
        this.parentId = folder.getParent() != null ? folder.getParent().getId() : null;
        if (folder.getUser() != null) {
            this.userId = folder.getUser().getId();
            this.userEmail = folder.getUser().getEmail();
        }
        this.createdAt = folder.getCreatedAt();
        this.updatedAt = folder.getUpdatedAt();
        this.isShared = isShared;
        this.permission = permission != null ? permission : "OWNER";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }

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
