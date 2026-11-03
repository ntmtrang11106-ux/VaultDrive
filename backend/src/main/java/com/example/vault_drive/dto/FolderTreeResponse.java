package com.example.vault_drive.dto;

import java.util.ArrayList;
import java.util.List;

public class FolderTreeResponse {
    private Long id;
    private String name;
    private Long parentId;
    private List<FolderTreeResponse> children = new ArrayList<>();

    public FolderTreeResponse() {}

    public FolderTreeResponse(Long id, String name, Long parentId) {
        this.id = id;
        this.name = name;
        this.parentId = parentId;
        this.children = new ArrayList<>();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }

    public List<FolderTreeResponse> getChildren() { return children; }
    public void setChildren(List<FolderTreeResponse> children) { this.children = children; }
}
