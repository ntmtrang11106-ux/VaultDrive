package com.example.vault_drive.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "file_shares",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"file_id", "shared_to_user_id"}),
        @UniqueConstraint(columnNames = {"folder_id", "shared_to_user_id"})
    }
)
public class FileShare {

    public enum Permission {
        VIEW,
        EDIT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", nullable = true)
    private FileItem file;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id", nullable = true)
    private Folder folder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_by_user_id", nullable = false)
    private User sharedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_to_user_id", nullable = false)
    private User sharedTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Permission permission = Permission.VIEW;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public FileShare() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public FileShare(FileItem file, Folder folder, User sharedBy, User sharedTo, Permission permission) {
        this.file = file;
        this.folder = folder;
        this.sharedBy = sharedBy;
        this.sharedTo = sharedTo;
        this.permission = permission;
        this.isDeleted = false;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        validateXor();
    }

    @PrePersist
    @PreUpdate
    public void validateXor() {
        boolean hasFile = (file != null);
        boolean hasFolder = (folder != null);
        if ((hasFile && hasFolder) || (!hasFile && !hasFolder)) {
            throw new IllegalArgumentException("A share record must point to EITHER a file OR a folder, but not both or neither.");
        }
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public FileItem getFile() { return file; }
    public void setFile(FileItem file) { this.file = file; }

    public Folder getFolder() { return folder; }
    public void setFolder(Folder folder) { this.folder = folder; }

    public User getSharedBy() { return sharedBy; }
    public void setSharedBy(User sharedBy) { this.sharedBy = sharedBy; }

    public User getSharedTo() { return sharedTo; }
    public void setSharedTo(User sharedTo) { this.sharedTo = sharedTo; }

    public Permission getPermission() { return permission; }
    public void setPermission(Permission permission) { this.permission = permission; }

    public Boolean getIsDeleted() { return isDeleted; }
    public void setIsDeleted(Boolean isDeleted) { this.isDeleted = isDeleted; }

    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
