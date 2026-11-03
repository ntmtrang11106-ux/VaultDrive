package com.example.vault_drive.controller;

import com.example.vault_drive.dto.ShareLinkCreateRequest;
import com.example.vault_drive.dto.ShareLinkResponse;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.ShareLinkService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/share-links")
@CrossOrigin(origins = "*")
public class ShareLinkController {

    private final ShareLinkService shareLinkService;
    private final AccessControlService accessControlService;

    public ShareLinkController(ShareLinkService shareLinkService, AccessControlService accessControlService) {
        this.shareLinkService = shareLinkService;
        this.accessControlService = accessControlService;
    }

    @PostMapping
    public ResponseEntity<ShareLinkResponse> createShareLink(@Valid @RequestBody ShareLinkCreateRequest request) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(shareLinkService.createShareLink(currentUser, request));
    }

    @GetMapping
    public ResponseEntity<List<ShareLinkResponse>> getShareLinks(
            @RequestParam(value = "fileId", required = false) Long fileId,
            @RequestParam(value = "folderId", required = false) Long folderId) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(shareLinkService.getShareLinksForResource(currentUser, fileId, folderId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deactivateShareLink(@PathVariable("id") Long id) {
        User currentUser = accessControlService.getCurrentUser();
        shareLinkService.deactivateShareLink(currentUser, id);
        return ResponseEntity.ok(Map.of("message", "Đã thu hồi / vô hiệu hóa link chia sẻ thành công!"));
    }
}
