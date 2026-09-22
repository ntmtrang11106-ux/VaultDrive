package com.example.vault_drive.repository;

import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.FileShare;
import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.ShareLink;
import com.example.vault_drive.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShareLinkRepository extends JpaRepository<ShareLink, Long> {
    Optional<ShareLink> findByToken(String token);
    Optional<ShareLink> findByFileAndIsActiveTrue(FileItem file);
    Optional<ShareLink> findByFolderAndIsActiveTrue(Folder folder);
    List<ShareLink> findByFile(FileItem file);
    List<ShareLink> findByFolder(Folder folder);
    List<ShareLink> findByCreatedBy(User createdBy);
}
