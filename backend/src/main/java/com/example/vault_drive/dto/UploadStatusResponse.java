package com.example.vault_drive.dto;

import com.example.vault_drive.entity.UploadSession;

import java.util.List;

public class UploadStatusResponse {
    private String sessionId;
    private String fileName;
    private Long totalSizeBytes;
    private Integer totalChunks;
    private Integer uploadedChunksCount;
    private Double progressPercentage;
    private Long uploadedBytes;
    private String status;
    private List<Integer> remainingChunks;

    public UploadStatusResponse() {}

    public UploadStatusResponse(UploadSession session, List<Integer> remainingChunks) {
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
        this.remainingChunks = remainingChunks;
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

    public List<Integer> getRemainingChunks() { return remainingChunks; }
    public void setRemainingChunks(List<Integer> remainingChunks) { this.remainingChunks = remainingChunks; }
}
