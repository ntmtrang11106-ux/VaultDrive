package com.example.vault_drive.repository;

import com.example.vault_drive.entity.StoragePlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StoragePlanRepository extends JpaRepository<StoragePlan, Long> {
    Optional<StoragePlan> findByName(String name);
}
