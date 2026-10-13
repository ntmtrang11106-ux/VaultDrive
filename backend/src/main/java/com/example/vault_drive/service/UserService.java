package com.example.vault_drive.service;

import com.example.vault_drive.dto.ChangePasswordRequest;
import com.example.vault_drive.dto.UpdateProfileRequest;
import com.example.vault_drive.dto.UserProfileResponse;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getUserProfile(User currentUser) {
        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin người dùng!"));
        return new UserProfileResponse(user);
    }

    @Transactional
    public UserProfileResponse updateUserProfile(User currentUser, UpdateProfileRequest request) {
        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin người dùng!"));

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName().trim());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone().trim());
        }
        if (request.getDob() != null) {
            user.setDob(request.getDob());
        }
        if (request.getGender() != null) {
            user.setGender(request.getGender().trim().toUpperCase());
        }

        User savedUser = userRepository.save(user);
        return new UserProfileResponse(savedUser);
    }

    @Transactional
    public void changePassword(User currentUser, ChangePasswordRequest request) {
        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin người dùng!"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new RuntimeException("Mật khẩu hiện tại không chính xác!");
        }

        if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
            throw new RuntimeException("Mật khẩu mới phải có ít nhất 8 ký tự!");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new RuntimeException("Mật khẩu mới và xác nhận mật khẩu không trùng khớp!");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }
}
