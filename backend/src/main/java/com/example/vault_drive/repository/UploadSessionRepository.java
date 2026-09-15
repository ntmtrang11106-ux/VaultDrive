package com.example.vault_drive.repository;

import com.example.vault_drive.entity.UploadSession;
import com.example.vault_drive.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UploadSessionRepository extends JpaRepository<UploadSession, String> {
    Optional<UploadSession> findByIdAndIsDeletedFalse(String id);
    List<UploadSession> findByUserAndIsDeletedFalse(User user);
}
