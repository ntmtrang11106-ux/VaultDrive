package com.example.vault_drive.repository;

import com.example.vault_drive.entity.User;
import com.example.vault_drive.entity.UserStorage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserStorageRepository extends JpaRepository<UserStorage, Long> {
    Optional<UserStorage> findByUser(User user);
    Optional<UserStorage> findByUserId(Long userId);
}
