package com.example.vault_drive.repository;

import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileItemRepository extends JpaRepository<FileItem, Long> {
    List<FileItem> findByUserAndFolderIsNullAndIsTrashedFalseAndIsDeletedFalse(User user);
    List<FileItem> findByUserAndFolderIdAndIsTrashedFalseAndIsDeletedFalse(User user, Long folderId);
    List<FileItem> findByFolderIdAndIsTrashedFalseAndIsDeletedFalse(Long folderId);
    List<FileItem> findByUserAndIsTrashedTrueAndIsDeletedFalse(User user);
    Optional<FileItem> findByIdAndIsDeletedFalse(Long id);
    List<FileItem> findByFolderIdAndIsDeletedFalse(Long folderId);
}
