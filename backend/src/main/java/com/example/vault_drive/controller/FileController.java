package com.example.vault_drive.controller;

import com.example.vault_drive.dto.FileItemResponse;
import com.example.vault_drive.dto.MoveRequest;
import com.example.vault_drive.dto.RenameRequest;
import com.example.vault_drive.dto.SearchResponse;
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

    @GetMapping("/search")
    public ResponseEntity<SearchResponse> search(
            @RequestParam(value = "q", required = false, defaultValue = "") String query) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(fileService.search(currentUser, query));
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
        String contentType = resolveContentType(path, file.getFileName());

        String displayName = (file.getFileName() != null && !file.getFileName().isBlank()) ? file.getFileName() : "file";
        ContentDisposition contentDisposition = ContentDisposition.inline()
                .filename(displayName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .body(resource);
    }

    private String resolveContentType(Path path, String displayName) {
        String contentType = null;
        try {
            contentType = Files.probeContentType(path);
        } catch (Exception ignored) {}

        if (contentType == null || "application/octet-stream".equalsIgnoreCase(contentType)) {
            String name = (displayName != null) ? displayName.toLowerCase() : path.getFileName().toString().toLowerCase();
            if (name.endsWith(".cpp") || name.endsWith(".c") || name.endsWith(".h") || name.endsWith(".hpp")
                    || name.endsWith(".cc") || name.endsWith(".cxx") || name.endsWith(".hh") || name.endsWith(".hxx")
                    || name.endsWith(".java") || name.endsWith(".py") || name.endsWith(".js") || name.endsWith(".jsx")
                    || name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".html") || name.endsWith(".htm")
                    || name.endsWith(".xhtml") || name.endsWith(".css") || name.endsWith(".scss") || name.endsWith(".sass")
                    || name.endsWith(".less") || name.endsWith(".json") || name.endsWith(".sql") || name.endsWith(".xml")
                    || name.endsWith(".yaml") || name.endsWith(".yml") || name.endsWith(".toml") || name.endsWith(".txt")
                    || name.endsWith(".md") || name.endsWith(".log") || name.endsWith(".ini") || name.endsWith(".env")
                    || name.endsWith(".conf") || name.endsWith(".sh") || name.endsWith(".bat") || name.endsWith(".cmd")
                    || name.endsWith(".ps1") || name.endsWith(".cs") || name.endsWith(".go") || name.endsWith(".rs")
                    || name.endsWith(".kt") || name.endsWith(".dart") || name.endsWith(".php") || name.endsWith(".rb")
                    || name.endsWith(".vue") || name.endsWith(".svelte")) {
                return "text/plain; charset=UTF-8";
            }
            if (name.endsWith(".svg")) {
                return "image/svg+xml";
            }
            return "application/octet-stream";
        }
        return contentType;
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

        String downloadName = (file.getFileName() != null && !file.getFileName().isBlank()) ? file.getFileName() : "file";
        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(downloadName, StandardCharsets.UTF_8)
                .build();

        long fileSize = Files.size(path);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .contentLength(fileSize)
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
