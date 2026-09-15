package com.example.vault_drive.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class UploadInitRequest {

    @NotBlank(message = "File name is required")
    private String fileName;

    @NotNull(message = "Total size in bytes is required")
    @Min(value = 1, message = "Total size must be greater than 0")
    private Long totalSizeBytes;

    @NotNull(message = "Total chunks is required")
    @Min(value = 1, message = "Total chunks must be at least 1")
    private Integer totalChunks;

    private Long targetFolderId;

    public UploadInitRequest() {}

    public UploadInitRequest(String fileName, Long totalSizeBytes, Integer totalChunks, Long targetFolderId) {
        this.fileName = fileName;
        this.totalSizeBytes = totalSizeBytes;
        this.totalChunks = totalChunks;
        this.targetFolderId = targetFolderId;
    }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public Long getTotalSizeBytes() { return totalSizeBytes; }
    public void setTotalSizeBytes(Long totalSizeBytes) { this.totalSizeBytes = totalSizeBytes; }

    public Integer getTotalChunks() { return totalChunks; }
    public void setTotalChunks(Integer totalChunks) { this.totalChunks = totalChunks; }

    public Long getTargetFolderId() { return targetFolderId; }
    public void setTargetFolderId(Long targetFolderId) { this.targetFolderId = targetFolderId; }
}
