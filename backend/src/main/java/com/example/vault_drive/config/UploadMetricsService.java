package com.example.vault_drive.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

@Service
public class UploadMetricsService {

    private final Counter uploadBytesTotal;
    private final Counter uploadTotal;
    private final Counter uploadSuccessTotal;
    private final Counter hashCheckTotal;
    private final Counter hashPassTotal;

    public UploadMetricsService(MeterRegistry registry) {
        this.uploadBytesTotal = Counter.builder("vaultdrive_upload_bytes")
                .description("Tong so bytes da upload").register(registry);
        this.uploadTotal = Counter.builder("vaultdrive_upload")
                .description("Tong so luot upload chunk").register(registry);
        this.uploadSuccessTotal = Counter.builder("vaultdrive_upload_success")
                .description("Tong so luot upload chunk thanh cong").register(registry);
        this.hashCheckTotal = Counter.builder("vaultdrive_hash_check")
                .description("Tong so luot kiem tra ma bam SHA-256").register(registry);
        this.hashPassTotal = Counter.builder("vaultdrive_hash_pass")
                .description("Tong so luot kiem tra ma bam SHA-256 hop le").register(registry);
    }

    // Khởi tạo giá trị mồi ban đầu để tỷ lệ % khởi điểm là 100% thay vì NaN (chia cho 0)
    @PostConstruct
    public void initCounters() {
        this.uploadTotal.increment(1);
        this.uploadSuccessTotal.increment(1);
        this.hashCheckTotal.increment(1);
        this.hashPassTotal.increment(1);
    }

    // Gọi hàm này mỗi khi nhận 1 chunk hoặc 1 file upload
    public void recordChunkUpload(long byteSize, boolean isUploadSuccess, boolean isHashValid) {
        this.uploadTotal.increment();
        this.hashCheckTotal.increment();

        if (isUploadSuccess) {
            this.uploadBytesTotal.increment(byteSize);
            this.uploadSuccessTotal.increment();
        }
        if (isHashValid) {
            this.hashPassTotal.increment();
        }
    }
}