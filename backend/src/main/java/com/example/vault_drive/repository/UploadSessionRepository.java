package com.example.vault_drive.repository;

import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.UploadSession;
import com.example.vault_drive.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UploadSessionRepository extends JpaRepository<UploadSession, String> {
    Optional<UploadSession> findByIdAndIsDeletedFalse(String id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM UploadSession s WHERE s.id = :id AND s.isDeleted = false")
    Optional<UploadSession> findByIdAndIsDeletedFalseWithLock(@Param("id") String id);

    List<UploadSession> findByUserAndIsDeletedFalse(User user);

    @Query("SELECT s FROM UploadSession s WHERE s.user = :user AND s.fileName = :fileName " +
           "AND s.totalSizeBytes = :totalSizeBytes AND s.isDeleted = false " +
           "AND ((:targetFolder IS NULL AND s.targetFolder IS NULL) OR s.targetFolder = :targetFolder) " +
           "AND s.status IN (com.example.vault_drive.entity.UploadSession.Status.UPLOADING, com.example.vault_drive.entity.UploadSession.Status.PAUSED) " +
           "ORDER BY s.createdAt DESC")
    List<UploadSession> findActiveSessionsForFile(
            @Param("user") User user,
            @Param("fileName") String fileName,
            @Param("totalSizeBytes") Long totalSizeBytes,
            @Param("targetFolder") Folder targetFolder
    );
}
