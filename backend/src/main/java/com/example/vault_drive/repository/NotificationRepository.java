package com.example.vault_drive.repository;

import com.example.vault_drive.entity.Notification;
import com.example.vault_drive.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserAndIsDeletedFalseOrderByCreatedAtDesc(User user);
    Optional<Notification> findByIdAndIsDeletedFalse(Long id);
}
