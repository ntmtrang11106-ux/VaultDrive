package com.example.vault_drive.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdatePermissionRequest {

    @NotBlank(message = "Permission is required")
    private String permission; // "VIEW" or "EDIT"

    public UpdatePermissionRequest() {}

    public UpdatePermissionRequest(String permission) {
        this.permission = permission;
    }

    public String getPermission() { return permission; }
    public void setPermission(String permission) { this.permission = permission; }
}
