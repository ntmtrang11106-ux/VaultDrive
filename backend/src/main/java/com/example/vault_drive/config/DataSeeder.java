package com.example.vault_drive.config;

import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner initDatabase(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            // Kiểm tra nếu DB chưa có user nào thì mới seed dữ liệu mẫu
            if (userRepository.count() == 0) {
                
                // 1. Tạo tài khoản Admin
                User admin = new User();
                admin.setUsername("admin");
                admin.setPassword(passwordEncoder.encode("admin123"));
                admin.setRole("ROLE_ADMIN");
                userRepository.save(admin);

                // 2. Tạo tài khoản User mẫu 1
                User user1 = new User();
                user1.setUsername("tien");
                user1.setPassword(passwordEncoder.encode("123456"));
                user1.setRole("ROLE_USER");
                userRepository.save(user1);

                // 3. Tạo tài khoản User mẫu 2
                User user2 = new User();
                user2.setUsername("testuser");
                user2.setPassword(passwordEncoder.encode("password123"));
                user2.setRole("ROLE_USER");
                userRepository.save(user2);

                System.out.println("====== [SEED DATA] Đã tạo thành công 3 user mẫu vào DB ======");
            }
        };
    }
}
