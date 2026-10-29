package com.example.vault_drive.dto;

import com.example.vault_drive.entity.UploadSession;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class UploadSessionResponse {
    private String sessionId;
    private String fileName;
    private Long totalSizeBytes;
    private Integer totalChunks;
    private Integer uploadedChunksCount;
    private Double progressPercentage;
    private Long uploadedBytes;
    private String status;
    private List<Integer> uploadedChunkIndices = new ArrayList<>();
    private Long targetFolderId;
    private LocalDateTime createdAt;

    public UploadSessionResponse() {
    }

    public UploadSessionResponse(UploadSession session) {
        this.sessionId = session.getId();
        this.fileName = session.getFileName();
        this.totalSizeBytes = session.getTotalSizeBytes();
        this.totalChunks = session.getTotalChunks();
        this.uploadedChunksCount = session.getUploadedChunksCount();
        this.uploadedChunkIndices = parseIndicesToList(session.getUploadedChunkIndices());
        if (session.getTotalChunks() > 0) {
            this.progressPercentage = Math.min(100.0,
                    Math.round(((double) session.getUploadedChunksCount() / session.getTotalChunks()) * 10000.0)
                            / 100.0);
            this.uploadedBytes = Math.min(session.getTotalSizeBytes(),
                    Math.round(((double) session.getUploadedChunksCount() / session.getTotalChunks())
                            * session.getTotalSizeBytes()));
        } else {
            this.progressPercentage = 0.0;
            this.uploadedBytes = 0L;
        }
        this.status = session.getStatus().name();
        this.targetFolderId = session.getTargetFolder() != null ? session.getTargetFolder().getId() : null;
        this.createdAt = session.getCreatedAt();
    }

    public static List<Integer> parseIndicesToList(String indicesStr) {
        if (indicesStr == null || indicesStr.isBlank()) {
            return new ArrayList<>();
        }
        Set<Integer> set = new HashSet<>();
        String[] parts = indicesStr.split(",");
        for (String part : parts) {
            part = part.trim();
            if (part.isEmpty())
                continue;
            int dashIdx = part.indexOf('-');
            if (dashIdx > 0) {
                try {
                    int start = Integer.parseInt(part.substring(0, dashIdx));
                    int end = Integer.parseInt(part.substring(dashIdx + 1));
                    for (int i = start; i <= end; i++) {
                        set.add(i);
                    }
                } catch (NumberFormatException ignored) {
                }
            } else {
                try {
                    set.add(Integer.parseInt(part));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        List<Integer> list = new ArrayList<>(set);
        Collections.sort(list);
        return list;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public Long getTotalSizeBytes() {
        return totalSizeBytes;
    }

    public void setTotalSizeBytes(Long totalSizeBytes) {
        this.totalSizeBytes = totalSizeBytes;
    }

    public Integer getTotalChunks() {
        return totalChunks;
    }

    public void setTotalChunks(Integer totalChunks) {
        this.totalChunks = totalChunks;
    }

    public Integer getUploadedChunksCount() {
        return uploadedChunksCount;
    }

    public void setUploadedChunksCount(Integer uploadedChunksCount) {
        this.uploadedChunksCount = uploadedChunksCount;
    }

    public Double getProgressPercentage() {
        return progressPercentage;
    }

    public void setProgressPercentage(Double progressPercentage) {
        this.progressPercentage = progressPercentage;
    }

    public Long getUploadedBytes() {
        return uploadedBytes;
    }

    public void setUploadedBytes(Long uploadedBytes) {
        this.uploadedBytes = uploadedBytes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<Integer> getUploadedChunkIndices() {
        return uploadedChunkIndices;
    }

    public void setUploadedChunkIndices(List<Integer> uploadedChunkIndices) {
        this.uploadedChunkIndices = uploadedChunkIndices != null ? uploadedChunkIndices : new ArrayList<>();
    }

    public Long getTargetFolderId() {
        return targetFolderId;
    }

    public void setTargetFolderId(Long targetFolderId) {
        this.targetFolderId = targetFolderId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
