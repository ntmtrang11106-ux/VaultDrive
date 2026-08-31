package com.example.vault_drive.service;

import com.example.vault_drive.dto.LoginRequest;
import com.example.vault_drive.dto.RegisterRequest;
import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public String register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username đã tồn tại!");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        // Mã hóa mật khẩu trước khi lưu
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole("ROLE_USER");

        userRepository.save(user);
        return "Đăng ký tài khoản thành công!";
    }

    public String login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("Username hoặc Password không đúng!"));

        // Kiểm tra mật khẩu khớp với bản mã hóa trong DB
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Username hoặc Password không đúng!");
        }

        return "Đăng nhập thành công!";
    }
}