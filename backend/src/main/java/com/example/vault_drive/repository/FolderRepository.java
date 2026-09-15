package com.example.vault_drive.repository;

import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FolderRepository extends JpaRepository<Folder, Long> {
    List<Folder> findByUserAndParentIsNullAndIsTrashedFalseAndIsDeletedFalse(User user);
    List<Folder> findByUserAndParentIdAndIsTrashedFalseAndIsDeletedFalse(User user, Long parentId);
    List<Folder> findByUserAndIsTrashedFalseAndIsDeletedFalse(User user);
    List<Folder> findByUserAndIsTrashedTrueAndIsDeletedFalse(User user);
    Optional<Folder> findByIdAndIsDeletedFalse(Long id);
    List<Folder> findByParentIdAndIsDeletedFalse(Long parentId);
}
