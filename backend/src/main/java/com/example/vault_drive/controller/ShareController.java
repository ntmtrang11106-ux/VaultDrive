package com.example.vault_drive.controller;

import com.example.vault_drive.dto.ShareRequest;
import com.example.vault_drive.dto.ShareResponse;
import com.example.vault_drive.dto.UpdatePermissionRequest;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.ShareService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shares")
@CrossOrigin(origins = "*")
public class ShareController {

    private final ShareService shareService;
    private final AccessControlService accessControlService;

    public ShareController(ShareService shareService, AccessControlService accessControlService) {
        this.shareService = shareService;
        this.accessControlService = accessControlService;
    }

    @PostMapping
    public ResponseEntity<ShareResponse> shareItem(@Valid @RequestBody ShareRequest request) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(shareService.shareItem(currentUser, request));
    }

    @GetMapping("/users")
    public ResponseEntity<List<ShareResponse>> getSharedUsersForItem(
            @RequestParam(value = "fileId", required = false) Long fileId,
            @RequestParam(value = "folderId", required = false) Long folderId) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(shareService.getSharedUsersForItem(currentUser, fileId, folderId));
    }

    @PutMapping("/{shareId}")
    public ResponseEntity<ShareResponse> updatePermission(
            @PathVariable("shareId") Long shareId,
            @Valid @RequestBody UpdatePermissionRequest request) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(shareService.updateSharePermission(currentUser, shareId, request));
    }

    @DeleteMapping("/{shareId}")
    public ResponseEntity<Map<String, String>> revokeShare(@PathVariable("shareId") Long shareId) {
        User currentUser = accessControlService.getCurrentUser();
        shareService.revokeShare(currentUser, shareId);
        return ResponseEntity.ok(Map.of("message", "Thu hồi quyền chia sẻ thành công!"));
    }

    @GetMapping("/shared-with-me")
    public ResponseEntity<List<ShareResponse>> getSharedWithMe() {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(shareService.getSharedWithMe(currentUser));
    }
}
