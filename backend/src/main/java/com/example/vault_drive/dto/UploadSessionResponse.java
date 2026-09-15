package com.example.vault_drive.dto;

import com.example.vault_drive.entity.UploadSession;

import java.time.LocalDateTime;

public class UploadSessionResponse {
    private String sessionId;
    private String fileName;
    private Long totalSizeBytes;
    private Integer totalChunks;
    private Integer uploadedChunksCount;
    private Double progressPercentage;
    private Long uploadedBytes;
    private String status;
    private Long targetFolderId;
    private LocalDateTime createdAt;

    public UploadSessionResponse() {}

    public UploadSessionResponse(UploadSession session) {
        this.sessionId = session.getId();
        this.fileName = session.getFileName();
        this.totalSizeBytes = session.getTotalSizeBytes();
        this.totalChunks = session.getTotalChunks();
        this.uploadedChunksCount = session.getUploadedChunksCount();
        if (session.getTotalChunks() > 0) {
            this.progressPercentage = Math.min(100.0, Math.round(((double) session.getUploadedChunksCount() / session.getTotalChunks()) * 10000.0) / 100.0);
            this.uploadedBytes = Math.min(session.getTotalSizeBytes(), Math.round(((double) session.getUploadedChunksCount() / session.getTotalChunks()) * session.getTotalSizeBytes()));
        } else {
            this.progressPercentage = 0.0;
            this.uploadedBytes = 0L;
        }
        this.status = session.getStatus().name();
        this.targetFolderId = session.getTargetFolder() != null ? session.getTargetFolder().getId() : null;
        this.createdAt = session.getCreatedAt();
    }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public Long getTotalSizeBytes() { return totalSizeBytes; }
    public void setTotalSizeBytes(Long totalSizeBytes) { this.totalSizeBytes = totalSizeBytes; }

    public Integer getTotalChunks() { return totalChunks; }
    public void setTotalChunks(Integer totalChunks) { this.totalChunks = totalChunks; }

    public Integer getUploadedChunksCount() { return uploadedChunksCount; }
    public void setUploadedChunksCount(Integer uploadedChunksCount) { this.uploadedChunksCount = uploadedChunksCount; }

    public Double getProgressPercentage() { return progressPercentage; }
    public void setProgressPercentage(Double progressPercentage) { this.progressPercentage = progressPercentage; }

    public Long getUploadedBytes() { return uploadedBytes; }
    public void setUploadedBytes(Long uploadedBytes) { this.uploadedBytes = uploadedBytes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getTargetFolderId() { return targetFolderId; }
    public void setTargetFolderId(Long targetFolderId) { this.targetFolderId = targetFolderId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
