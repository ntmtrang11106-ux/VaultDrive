package com.example.vault_drive.controller;

import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.service.FileService;
import com.example.vault_drive.service.ShareLinkService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
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

        String downloadName = (file.getFileName() != null && !file.getFileName().isBlank()) ? file.getFileName() : "file";
        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(downloadName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .body(resource);
    }
}
