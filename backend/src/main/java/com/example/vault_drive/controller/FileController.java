package com.example.vault_drive.controller;

import com.example.vault_drive.dto.FileItemResponse;
import com.example.vault_drive.dto.MoveRequest;
import com.example.vault_drive.dto.RenameRequest;
import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.FileService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*")
public class FileController {

    private final FileService fileService;
    private final AccessControlService accessControlService;

    public FileController(FileService fileService, AccessControlService accessControlService) {
        this.fileService = fileService;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<Resource> previewFile(@PathVariable("id") Long fileId) throws IOException {
        User currentUser = accessControlService.getCurrentUser();
        FileItem file = fileService.getFileForPreview(currentUser, fileId);
        Path path = Paths.get(file.getFilePath()).toAbsolutePath();

        if (!Files.exists(path)) {
            throw new RuntimeException("File không tồn tại trên hệ thống lưu trữ!");
        }

        Resource resource = new UrlResource(path.toUri());
        String contentType = Files.probeContentType(path);
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        String displayName = (file.getFileName() != null && !file.getFileName().isBlank()) ? file.getFileName() : file.getOriginalName();
        if (displayName == null || displayName.isBlank()) displayName = "file";
        ContentDisposition contentDisposition = ContentDisposition.inline()
                .filename(displayName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .body(resource);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable("id") Long fileId) throws IOException {
        User currentUser = accessControlService.getCurrentUser();
        FileItem file = fileService.getFileForDownload(currentUser, fileId);
        Path path = Paths.get(file.getFilePath()).toAbsolutePath();

        if (!Files.exists(path)) {
            throw new RuntimeException("File không tồn tại trên hệ thống lưu trữ!");
        }

        Resource resource = new UrlResource(path.toUri());
        String contentType = Files.probeContentType(path);
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        String downloadName = (file.getFileName() != null && !file.getFileName().isBlank()) ? file.getFileName() : file.getOriginalName();
        if (downloadName == null || downloadName.isBlank()) downloadName = "file";
        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(downloadName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .body(resource);
    }

    @PatchMapping("/{id}/rename")
    public ResponseEntity<FileItemResponse> renameFile(
            @PathVariable("id") Long fileId,
            @Valid @RequestBody RenameRequest request) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(fileService.renameFile(currentUser, fileId, request));
    }

    @PatchMapping("/{id}/move")
    public ResponseEntity<FileItemResponse> moveFile(
            @PathVariable("id") Long fileId,
            @Valid @RequestBody MoveRequest request) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(fileService.moveFile(currentUser, fileId, request));
    }

    // API Upload từng Chunk (POST /api/files/upload-chunk)
    @PostMapping("/upload-chunk")
    public ResponseEntity<String> uploadChunk(@RequestParam("file") MultipartFile chunk,
                                            @RequestParam("fileName") String fileName,
                                            @RequestParam("chunkIndex") int chunkIndex) throws IOException {
        Path uploadDir = Paths.get("uploads");
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
        }
        Path path = uploadDir.resolve(fileName + ".part" + chunkIndex);

        chunk.transferTo(path.toAbsolutePath().toFile()); 

        return ResponseEntity.ok("Chunk " + chunkIndex + " uploaded successfully");
    }

    // API Merge Chunks bất đồng bộ (POST /api/files/merge-chunks)
    @PostMapping("/merge-chunks")
    public ResponseEntity<String> mergeChunks(@RequestParam String fileName, 
                                            @RequestParam int totalChunks) {
        if (fileName == null || fileName.isBlank() || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            return ResponseEntity.badRequest().body("Invalid file name");
        }
        if (totalChunks <= 0) {
            return ResponseEntity.badRequest().body("Total chunks must be greater than 0");
        }

        fileService.mergeChunksAsync(fileName, totalChunks);

        return ResponseEntity.ok("Merge task submitted successfully and processing in background");
    }
}
