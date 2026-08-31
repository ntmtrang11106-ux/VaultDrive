package com.example.vault_drive.controller;

import com.example.vault_drive.service.FileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileService fileService;

    // // 1. API Login cơ bản
    // @PostMapping("/login")
    // public ResponseEntity<String> login(@RequestParam String username, @RequestParam String password) {
    //     if ("admin".equals(username) && "123456".equals(password)) {
    //         return ResponseEntity.ok("Login successful");
    //     }
    //     return ResponseEntity.status(401).body("Invalid credentials");
    // }

    // 2. API Upload từng Chunk (POST /api/files/upload-chunk)
    @PostMapping("/upload-chunk")
    public ResponseEntity<String> uploadChunk(@RequestParam("file") MultipartFile chunk,
                                            @RequestParam("fileName") String fileName,
                                            @RequestParam("chunkIndex") int chunkIndex) throws IOException {
        Path uploadDir = Paths.get("uploads");
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
        }
        Path path = uploadDir.resolve(fileName + ".part" + chunkIndex);

        // FIX: Dùng toAbsolutePath() để tránh việc Tomcat gắn thêm đường dẫn tạm /tmp/tomcat/...
        chunk.transferTo(path.toAbsolutePath().toFile()); 

        return ResponseEntity.ok("Chunk " + chunkIndex + " uploaded successfully");
    }

    // 3. API Merge Chunks bất đồng bộ (POST /api/files/merge-chunks)
    @PostMapping("/merge-chunks")
    public ResponseEntity<String> mergeChunks(@RequestParam String fileName, 
                                            @RequestParam int totalChunks) {
        // 1. Sanitize & Validate input
        if (fileName == null || fileName.isBlank() || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            return ResponseEntity.badRequest().body("Invalid file name");
        }
        if (totalChunks <= 0) {
            return ResponseEntity.badRequest().body("Total chunks must be greater than 0");
        }

        // 2. Submit async task
        fileService.mergeChunksAsync(fileName, totalChunks);

        return ResponseEntity.ok("Merge task submitted successfully and processing in background");
    }
}
