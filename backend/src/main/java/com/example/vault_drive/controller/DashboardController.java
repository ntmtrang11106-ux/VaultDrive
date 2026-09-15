package com.example.vault_drive.controller;

import com.example.vault_drive.dto.*;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.DashboardService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class DashboardController {

    private final DashboardService dashboardService;
    private final AccessControlService accessControlService;

    public DashboardController(DashboardService dashboardService, AccessControlService accessControlService) {
        this.dashboardService = dashboardService;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/dashboard/storage")
    public ResponseEntity<StorageInfoResponse> getStorageInfo() {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(dashboardService.getStorageInfo(user));
    }

    @GetMapping("/folders/root")
    public ResponseEntity<DashboardResponse> getRootDashboard() {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(dashboardService.getRootDashboard(user));
    }

    @GetMapping("/folders/{id}/contents")
    public ResponseEntity<DashboardResponse> getFolderDashboard(@PathVariable("id") Long folderId) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(dashboardService.getFolderDashboard(user, folderId));
    }

    @GetMapping("/folders/tree")
    public ResponseEntity<List<FolderTreeResponse>> getFolderTree() {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(dashboardService.getFolderTree(user));
    }

    @PostMapping("/folders")
    public ResponseEntity<FolderResponse> createFolder(@Valid @RequestBody FolderCreateRequest request) {
        User user = accessControlService.getCurrentUser();
        return ResponseEntity.ok(dashboardService.createFolder(user, request));
    }
}
