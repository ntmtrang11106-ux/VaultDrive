package com.example.vault_drive.service;

import com.example.vault_drive.entity.FileItem;
import com.example.vault_drive.entity.FileShare;
import com.example.vault_drive.entity.Folder;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.FileShareRepository;
import com.example.vault_drive.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AccessControlService {

    private final UserRepository userRepository;
    private final FileShareRepository fileShareRepository;

    public AccessControlService(UserRepository userRepository, FileShareRepository fileShareRepository) {
        this.userRepository = userRepository;
        this.fileShareRepository = fileShareRepository;
    }

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            throw new RuntimeException("Người dùng chưa đăng nhập!");
        }
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin người dùng: " + email));
    }

    public boolean isOwner(User user, Folder folder) {
        if (user == null || folder == null || folder.getUser() == null) return false;
        return folder.getUser().getId().equals(user.getId());
    }

    public boolean isOwner(User user, FileItem file) {
        if (user == null || file == null || file.getUser() == null) return false;
        return file.getUser().getId().equals(user.getId());
    }

    public String getEffectiveFolderPermission(User user, Folder folder) {
        if (folder == null || user == null) return null;
        if (isOwner(user, folder)) return "OWNER";

        Optional<FileShare> directShare = fileShareRepository.findByFolderAndSharedToAndIsDeletedFalse(folder, user);
        if (directShare.isPresent()) {
            return directShare.get().getPermission().name();
        }

        // Recursive inheritance check on parent folders
        if (folder.getParent() != null) {
            return getEffectiveFolderPermission(user, folder.getParent());
        }

        return null;
    }

    public String getEffectiveFilePermission(User user, FileItem file) {
        if (file == null || user == null) return null;
        if (isOwner(user, file)) return "OWNER";

        Optional<FileShare> directShare = fileShareRepository.findByFileAndSharedToAndIsDeletedFalse(file, user);
        if (directShare.isPresent()) {
            return directShare.get().getPermission().name();
        }

        if (file.getFolder() != null) {
            return getEffectiveFolderPermission(user, file.getFolder());
        }

        return null;
    }

    public boolean hasFolderAccess(User user, Folder folder, String requiredPermission) {
        String perm = getEffectiveFolderPermission(user, folder);
        if (perm == null) return false;
        if ("OWNER".equalsIgnoreCase(perm)) return true;
        if ("EDIT".equalsIgnoreCase(requiredPermission)) {
            return "EDIT".equalsIgnoreCase(perm);
        }
        // requiredPermission is VIEW
        return "VIEW".equalsIgnoreCase(perm) || "EDIT".equalsIgnoreCase(perm);
    }

    public boolean hasFileAccess(User user, FileItem file, String requiredPermission) {
        String perm = getEffectiveFilePermission(user, file);
        if (perm == null) return false;
        if ("OWNER".equalsIgnoreCase(perm)) return true;
        if ("EDIT".equalsIgnoreCase(requiredPermission)) {
            return "EDIT".equalsIgnoreCase(perm);
        }
        return "VIEW".equalsIgnoreCase(perm) || "EDIT".equalsIgnoreCase(perm);
    }
}
