package com.example.vault_drive.controller;

import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.service.FileService;
import com.example.vault_drive.service.ShareLinkService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

@RestController
@RequestMapping("/api/public/share-links")
@CrossOrigin(origins = "*")
public class PublicShareLinkController {

    private final ShareLinkService shareLinkService;

    public PublicShareLinkController(ShareLinkService shareLinkService) {
        this.shareLinkService = shareLinkService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<Map<String, Object>> getPublicLinkDetails(
            @PathVariable("token") String token,
            @RequestParam(value = "folderId", required = false) Long folderId) {
        return ResponseEntity.ok(shareLinkService.getPublicLinkDetails(token, folderId));
    }

    @GetMapping("/{token}/preview")
    public ResponseEntity<Resource> previewPublicFile(
            @PathVariable("token") String token,
            @RequestParam(value = "fileId", required = false) Long fileId) throws IOException {
        FileItem file = shareLinkService.getPublicFileForPreviewOrDownload(token, fileId);
        Path path = Paths.get(file.getFilePath()).toAbsolutePath();

        if (!Files.exists(path)) {
            throw new RuntimeException("File không tồn tại trên hệ thống lưu trữ!");
        }

        Resource resource = new UrlResource(path.toUri());
        String contentType = Files.probeContentType(path);
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getOriginalName() + "\"")
                .body(resource);
    }

    @GetMapping("/{token}/download")
    public ResponseEntity<Resource> downloadPublicFile(
            @PathVariable("token") String token,
            @RequestParam(value = "fileId", required = false) Long fileId) throws IOException {
        FileItem file = shareLinkService.getPublicFileForPreviewOrDownload(token, fileId);
        Path path = Paths.get(file.getFilePath()).toAbsolutePath();

        if (!Files.exists(path)) {
            throw new RuntimeException("File không tồn tại trên hệ thống lưu trữ!");
        }

        Resource resource = new UrlResource(path.toUri());
        String contentType = Files.probeContentType(path);
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getOriginalName() + "\"")
                .body(resource);
    }
}
