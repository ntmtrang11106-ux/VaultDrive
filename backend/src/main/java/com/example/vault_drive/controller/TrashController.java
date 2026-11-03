package com.example.vault_drive.controller;

import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.TrashService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class TrashController {

    private final TrashService trashService;
    private final AccessControlService accessControlService;

    public TrashController(TrashService trashService, AccessControlService accessControlService) {
        this.trashService = trashService;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/trash")
    public ResponseEntity<Map<String, Object>> getTrashItems() {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(trashService.getTrashItems(currentUser));
    }

    @PatchMapping("/folders/{id}/trash")
    public ResponseEntity<Map<String, String>> trashFolder(@PathVariable("id") Long folderId) {
        User currentUser = accessControlService.getCurrentUser();
        trashService.trashFolder(currentUser, folderId);
        return ResponseEntity.ok(Map.of("message", "Đã chuyển thư mục vào thùng rác thành công!"));
    }

    @PatchMapping("/folders/{id}/restore")
    public ResponseEntity<Map<String, String>> restoreFolder(@PathVariable("id") Long folderId) {
        User currentUser = accessControlService.getCurrentUser();
        trashService.restoreFolder(currentUser, folderId);
        return ResponseEntity.ok(Map.of("message", "Khôi phục thư mục thành công!"));
    }

    @DeleteMapping("/folders/{id}/permanent")
    public ResponseEntity<Map<String, String>> permanentDeleteFolder(@PathVariable("id") Long folderId) {
        User currentUser = accessControlService.getCurrentUser();
        trashService.permanentDeleteFolder(currentUser, folderId);
        return ResponseEntity.ok(Map.of("message", "Đã xóa vĩnh viễn thư mục thành công!"));
    }

    @PatchMapping("/files/{id}/trash")
    public ResponseEntity<Map<String, String>> trashFile(@PathVariable("id") Long fileId) {
        User currentUser = accessControlService.getCurrentUser();
        trashService.trashFile(currentUser, fileId);
        return ResponseEntity.ok(Map.of("message", "Đã chuyển file vào thùng rác thành công!"));
    }

    @PatchMapping("/files/{id}/restore")
    public ResponseEntity<Map<String, String>> restoreFile(@PathVariable("id") Long fileId) {
        User currentUser = accessControlService.getCurrentUser();
        trashService.restoreFile(currentUser, fileId);
        return ResponseEntity.ok(Map.of("message", "Khôi phục file thành công!"));
    }

    @DeleteMapping("/files/{id}/permanent")
    public ResponseEntity<Map<String, String>> permanentDeleteFile(@PathVariable("id") Long fileId) {
        User currentUser = accessControlService.getCurrentUser();
        trashService.permanentDeleteFile(currentUser, fileId);
        return ResponseEntity.ok(Map.of("message", "Đã xóa vĩnh viễn file thành công!"));
    }
}
