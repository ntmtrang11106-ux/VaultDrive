package com.example.vault_drive.config;

import com.example.vault_drive.entity.User;
import com.example.vault_drive.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner initDatabase(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() == 0) {
                
                // 1. Tạo tài khoản Admin
                User admin = new User();
                admin.setEmail("admin@vaultdrive.com");
                admin.setPassword(passwordEncoder.encode("admin123"));
                admin.setRole("ROLE_ADMIN");
                admin.setFullName("System Administrator");
                admin.setPhone("0905123456");
                admin.setDob(LocalDate.of(2000, 1, 1));
                admin.setGender("FEMALE");
                userRepository.save(admin);

                // 2. Tạo tài khoản User mẫu 1
                User user1 = new User();
                user1.setEmail("tien@vaultdrive.com");
                user1.setPassword(passwordEncoder.encode("123456"));
                user1.setRole("ROLE_USER");
                user1.setFullName("Tien");
                user1.setPhone("0914111222");
                user1.setDob(LocalDate.of(2003, 5, 20));
                user1.setGender("FEMALE");
                userRepository.save(user1);

                // 3. Tạo tài khoản User mẫu 2
                User user2 = new User();
                user2.setEmail("testuser@vaultdrive.com");
                user2.setPassword(passwordEncoder.encode("password123"));
                user2.setRole("ROLE_USER");
                user2.setFullName("Nguyen Van A");
                user2.setPhone("0987654321");
                user2.setDob(LocalDate.of(2002, 10, 15));
                user2.setGender("MALE");
                userRepository.save(user2);

                System.out.println("====== [SEED DATA] Đã mã hóa mật khẩu và chèn 3 user mẫu vào DB thành công ======");
            }
        };
    }
}