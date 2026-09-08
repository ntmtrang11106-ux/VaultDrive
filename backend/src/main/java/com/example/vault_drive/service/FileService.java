package com.example.vault_drive.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.*;
import java.util.concurrent.CompletableFuture;

@Service
public class FileService {

    private final Path uploadDir = Paths.get("uploads");

    @Async("fileExecutor")
    public CompletableFuture<Boolean> mergeChunksAsync(String fileName, int totalChunks) {
        try {
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }
            Path destFile = uploadDir.resolve(fileName);
            
            // Mở FileChannel ghi file đích
            try (FileChannel destChannel = FileChannel.open(destFile, StandardOpenOption.CREATE, StandardOpenOption.WRITE)) {
                
                // Khóa file cấp OS tránh ghi chồng / Race Condition
                try (FileLock lock = destChannel.lock()) {
                    for (int i = 0; i < totalChunks; i++) {
                        Path chunkPath = uploadDir.resolve(fileName + ".part" + i);
                        if (Files.exists(chunkPath)) {
                            try (FileChannel srcChannel = FileChannel.open(chunkPath, StandardOpenOption.READ)) {
                                srcChannel.transferTo(0, srcChannel.size(), destChannel);
                            }
                            Files.deleteIfExists(chunkPath); // Dọn dẹp chunk sau khi ghép
                        }
                    }
                }
                return CompletableFuture.completedFuture(true);
            }
        } catch (IOException e) {
            e.printStackTrace();
            return CompletableFuture.completedFuture(false);
        }
    }
}