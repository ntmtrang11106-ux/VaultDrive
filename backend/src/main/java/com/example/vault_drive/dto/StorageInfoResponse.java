package com.example.vault_drive.dto;

public class StorageInfoResponse {
    private Long usedBytes;
    private Long maxBytes;
    private Double usedPercentage;

    public StorageInfoResponse() {}

    public StorageInfoResponse(Long usedBytes, Long maxBytes) {
        this.usedBytes = usedBytes != null ? usedBytes : 0L;
        this.maxBytes = maxBytes != null ? maxBytes : 0L;
        if (this.maxBytes > 0) {
            this.usedPercentage = Math.min(100.0, Math.round(((double) this.usedBytes / this.maxBytes) * 10000.0) / 100.0);
        } else {
            this.usedPercentage = 0.0;
        }
    }

    public Long getUsedBytes() { return usedBytes; }
    public void setUsedBytes(Long usedBytes) { this.usedBytes = usedBytes; }

    public Long getMaxBytes() { return maxBytes; }
    public void setMaxBytes(Long maxBytes) { this.maxBytes = maxBytes; }

    public Double getUsedPercentage() { return usedPercentage; }
    public void setUsedPercentage(Double usedPercentage) { this.usedPercentage = usedPercentage; }
}
