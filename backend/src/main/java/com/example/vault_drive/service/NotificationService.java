package com.example.vault_drive.service;

import com.example.vault_drive.dto.NotificationResponse;
import com.example.vault_drive.entity.Notification;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getUserNotifications(User user) {
        List<Notification> notifications = notificationRepository.findByUserAndIsDeletedFalseOrderByCreatedAtDesc(user);
        return notifications.stream().map(NotificationResponse::new).collect(Collectors.toList());
    }

    @Transactional
    public NotificationResponse markAsRead(User user, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndIsDeletedFalse(notificationId)
                .orElseThrow(() -> new RuntimeException("Thông báo không tồn tại!"));

        if (!notification.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền thay đổi thông báo này!");
        }

        notification.setIsRead(true);
        Notification saved = notificationRepository.save(notification);
        return new NotificationResponse(saved);
    }

    @Transactional
    public void deleteNotification(User user, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndIsDeletedFalse(notificationId)
                .orElseThrow(() -> new RuntimeException("Thông báo không tồn tại!"));

        if (!notification.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền xóa thông báo này!");
        }

        notification.setIsDeleted(true);
        notification.setDeletedAt(LocalDateTime.now());
        notificationRepository.save(notification);
    }
}
