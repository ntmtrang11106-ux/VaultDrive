package com.example.vault_drive.controller;

import com.example.vault_drive.dto.*;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.UploadService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*")
public class UploadController {

    private final UploadService uploadService;
    private final AccessControlService accessControlService;

    public UploadController(UploadService uploadService, AccessControlService accessControlService) {
        this.uploadService = uploadService;
        this.accessControlService = accessControlService;
    }

    @PostMapping("/init")
    public ResponseEntity<UploadSessionResponse> initUpload(@Valid @RequestBody UploadInitRequest request) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(uploadService.initUploadSession(user, request));
    }

    @PostMapping("/{sessionId}/chunk")
    public ResponseEntity<UploadSessionResponse> uploadChunk(
            @PathVariable("sessionId") String sessionId,
            @RequestParam("chunkIndex") int chunkIndex,
            @RequestParam("file") MultipartFile chunk) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(uploadService.uploadChunk(user, sessionId, chunkIndex, chunk));
    }

    @GetMapping("/{sessionId}/status")
    public ResponseEntity<UploadStatusResponse> getStatus(@PathVariable("sessionId") String sessionId) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(uploadService.getSessionStatus(user, sessionId));
    }

    @PostMapping("/{sessionId}/pause")
    public ResponseEntity<UploadSessionResponse> pauseUpload(@PathVariable("sessionId") String sessionId) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(uploadService.pauseUploadSession(user, sessionId));
    }

    @PostMapping("/{sessionId}/resume")
    public ResponseEntity<UploadStatusResponse> resumeUpload(@PathVariable("sessionId") String sessionId) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(uploadService.resumeUploadSession(user, sessionId));
    }

    @PostMapping("/{sessionId}/cancel")
    public ResponseEntity<UploadSessionResponse> cancelUpload(@PathVariable("sessionId") String sessionId) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(uploadService.cancelUploadSession(user, sessionId));
    }

    @PostMapping("/{sessionId}/complete")
    public ResponseEntity<FileItemResponse> completeUpload(@PathVariable("sessionId") String sessionId) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(uploadService.completeUploadSession(user, sessionId));
    }
}
