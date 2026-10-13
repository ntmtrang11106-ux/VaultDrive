package com.example.vault_drive.dto;

import com.example.vault_drive.entity.User;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class UserProfileResponse {
    private Long id;
    private String email;
    private String fullName;
    private String phone;
    private LocalDate dob;
    private String gender;
    private String role;
    private LocalDateTime createdAt;

    public UserProfileResponse() {}

    public UserProfileResponse(User user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.fullName = user.getFullName();
        this.phone = user.getPhone();
        this.dob = user.getDob();
        this.gender = user.getGender();
        this.role = user.getRole();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public LocalDate getDob() { return dob; }
    public void setDob(LocalDate dob) { this.dob = dob; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
