package com.example.vault_drive.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role; // Ví dụ: "ROLE_USER", "ROLE_ADMIN"

    @Column(name = "full_name")
    private String fullName;

    private String phone;

    private LocalDate dob; // Ngày sinh (yyyy-MM-dd)

    private String gender; // "MALE", "FEMALE", "OTHER"

    public User() {}

    public User(String email, String password, String role, String fullName, String phone, LocalDate dob, String gender) {
        this.email = email;
        this.password = password;
        this.role = role;
        this.fullName = fullName;
        this.phone = phone;
        this.dob = dob;
        this.gender = gender;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public LocalDate getDob() { return dob; }
    public void setDob(LocalDate dob) { this.dob = dob; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
}