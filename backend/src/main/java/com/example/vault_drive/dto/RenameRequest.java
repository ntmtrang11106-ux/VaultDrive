package com.example.vault_drive.dto;

import jakarta.validation.constraints.NotBlank;

public class RenameRequest {

    @NotBlank(message = "New name is required")
    private String name;

    public RenameRequest() {}

    public RenameRequest(String name) {
        this.name = name;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNewName() { return name; }
    public void setNewName(String newName) { this.name = newName; }
}
