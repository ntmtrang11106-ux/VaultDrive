package com.example.vault_drive.dto;

import java.util.List;

public class SearchResponse {
    private List<FolderResponse> folders;
    private List<FileItemResponse> files;

    public SearchResponse() {}

    public SearchResponse(List<FolderResponse> folders, List<FileItemResponse> files) {
        this.folders = folders;
        this.files = files;
    }

    public List<FolderResponse> getFolders() {
        return folders;
    }

    public void setFolders(List<FolderResponse> folders) {
        this.folders = folders;
    }

    public List<FileItemResponse> getFiles() {
        return files;
    }

    public void setFiles(List<FileItemResponse> files) {
        this.files = files;
    }
}

