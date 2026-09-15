package com.example.vault_drive.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "upload_sessions")
public class UploadSession {

    public enum Status {
        UPLOADING,
        PAUSED,
        COMPLETED,
        FAILED
    }

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_folder_id", nullable = true)
    private Folder targetFolder;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "total_size_bytes", nullable = false)
    private Long totalSizeBytes;

    @Column(name = "total_chunks", nullable = false)
    private Integer totalChunks;

    @Column(name = "uploaded_chunks_count", nullable = false)
    private Integer uploadedChunksCount = 0;

    @Column(name = "uploaded_chunk_indices", length = 4000)
    private String uploadedChunkIndices = "";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.UPLOADING;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public UploadSession() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public UploadSession(String id, User user, Folder targetFolder, String fileName, Long totalSizeBytes, Integer totalChunks) {
        this.id = id;
        this.user = user;
        this.targetFolder = targetFolder;
        this.fileName = fileName;
        this.totalSizeBytes = totalSizeBytes;
        this.totalChunks = totalChunks;
        this.uploadedChunksCount = 0;
        this.uploadedChunkIndices = "";
        this.status = Status.UPLOADING;
        this.isDeleted = false;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Folder getTargetFolder() { return targetFolder; }
    public void setTargetFolder(Folder targetFolder) { this.targetFolder = targetFolder; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public Long getTotalSizeBytes() { return totalSizeBytes; }
    public void setTotalSizeBytes(Long totalSizeBytes) { this.totalSizeBytes = totalSizeBytes; }

    public Integer getTotalChunks() { return totalChunks; }
    public void setTotalChunks(Integer totalChunks) { this.totalChunks = totalChunks; }

    public Integer getUploadedChunksCount() { return uploadedChunksCount; }
    public void setUploadedChunksCount(Integer uploadedChunksCount) { this.uploadedChunksCount = uploadedChunksCount; }

    public String getUploadedChunkIndices() { return uploadedChunkIndices; }
    public void setUploadedChunkIndices(String uploadedChunkIndices) { this.uploadedChunkIndices = uploadedChunkIndices; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public Boolean getIsDeleted() { return isDeleted; }
    public void setIsDeleted(Boolean isDeleted) { this.isDeleted = isDeleted; }

    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
