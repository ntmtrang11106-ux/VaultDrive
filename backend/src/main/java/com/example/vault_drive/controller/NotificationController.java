package com.example.vault_drive.controller;

import com.example.vault_drive.dto.NotificationResponse;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class NotificationController {

    private final NotificationService notificationService;
    private final AccessControlService accessControlService;

    public NotificationController(NotificationService notificationService, AccessControlService accessControlService) {
        this.notificationService = notificationService;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getUserNotifications() {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(notificationService.getUserNotifications(currentUser));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(@PathVariable("id") Long notificationId) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(notificationService.markAsRead(currentUser, notificationId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteNotification(@PathVariable("id") Long notificationId) {
        User currentUser = accessControlService.getCurrentUser();
        notificationService.deleteNotification(currentUser, notificationId);
        return ResponseEntity.ok(Map.of("message", "Đã xóa thông báo thành công!"));
    }
}
