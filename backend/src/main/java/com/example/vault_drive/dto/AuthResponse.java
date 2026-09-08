package com.example.vault_drive.dto;

public class AuthResponse {
    private String accessToken;
    private String tokenType = "Bearer";
    private String email;
    private String role;

    public AuthResponse(String accessToken, String email, String role) {
        this.accessToken = accessToken;
        this.email = email;
        this.role = role;
    }

    // Getters and Setters
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public String getTokenType() { return tokenType; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
}
