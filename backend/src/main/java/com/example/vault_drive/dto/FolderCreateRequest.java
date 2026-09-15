package com.example.vault_drive.dto;

import jakarta.validation.constraints.NotBlank;

public class FolderCreateRequest {
    @NotBlank(message = "Folder name is required")
    private String name;
    private Long parentId;

    public FolderCreateRequest() {}

    public FolderCreateRequest(String name, Long parentId) {
        this.name = name;
        this.parentId = parentId;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }
}
