package com.example.vault_drive.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "share_links")
public class ShareLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", nullable = true)
    private FileItem file;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id", nullable = true)
    private Folder folder;

    @Column(nullable = false, unique = true)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdBy;

    @Column(name = "expires_at", nullable = true)
    private LocalDateTime expiresAt;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public ShareLink() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public ShareLink(FileItem file, Folder folder, String token, User createdBy, LocalDateTime expiresAt) {
        this.file = file;
        this.folder = folder;
        this.token = token;
        this.createdBy = createdBy;
        this.expiresAt = expiresAt;
        this.isActive = true;
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
            throw new IllegalArgumentException("A share link must point to EITHER a file OR a folder, but not both or neither.");
        }
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public FileItem getFile() { return file; }
    public void setFile(FileItem file) { this.file = file; }

    public Folder getFolder() { return folder; }
    public void setFolder(Folder folder) { this.folder = folder; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
