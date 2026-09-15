package com.example.vault_drive.repository;

import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.FileShare;
import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileShareRepository extends JpaRepository<FileShare, Long> {
    Optional<FileShare> findByFileAndSharedToAndIsDeletedFalse(FileItem file, User sharedTo);
    Optional<FileShare> findByFolderAndSharedToAndIsDeletedFalse(Folder folder, User sharedTo);
    List<FileShare> findByFileAndIsDeletedFalse(FileItem file);
    List<FileShare> findByFolderAndIsDeletedFalse(Folder folder);
    List<FileShare> findBySharedToAndIsDeletedFalse(User sharedTo);
    Optional<FileShare> findByIdAndIsDeletedFalse(Long id);
}
