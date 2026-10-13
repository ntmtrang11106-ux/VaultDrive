package com.example.vault_drive.controller;

import com.example.vault_drive.dto.ChangePasswordRequest;
import com.example.vault_drive.dto.UpdateProfileRequest;
import com.example.vault_drive.dto.UserProfileResponse;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.service.AccessControlService;
import com.example.vault_drive.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;
    private final AccessControlService accessControlService;

    public UserController(UserService userService, AccessControlService accessControlService) {
        this.userService = userService;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUserProfile() {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(userService.getUserProfile(currentUser));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(@RequestBody UpdateProfileRequest request) {
        User currentUser = accessControlService.getCurrentUser();
        return ResponseEntity.ok(userService.updateUserProfile(currentUser, request));
    }

    @PutMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        User currentUser = accessControlService.getCurrentUser();
        userService.changePassword(currentUser, request);
        return ResponseEntity.ok(Map.of("message", "Cập nhật mật khẩu thành công!"));
    }
}
