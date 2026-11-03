package com.example.vault_drive.dto;

import java.util.List;

public class DashboardResponse {
    private FolderResponse currentFolder;
    private List<FolderResponse> subfolders;
    private List<FileItemResponse> files;
    private StorageInfoResponse storageInfo;

    public DashboardResponse() {}

    public DashboardResponse(FolderResponse currentFolder, List<FolderResponse> subfolders, List<FileItemResponse> files, StorageInfoResponse storageInfo) {
        this.currentFolder = currentFolder;
        this.subfolders = subfolders;
        this.files = files;
        this.storageInfo = storageInfo;
    }

    public FolderResponse getCurrentFolder() { return currentFolder; }
    public void setCurrentFolder(FolderResponse currentFolder) { this.currentFolder = currentFolder; }

    public List<FolderResponse> getSubfolders() { return subfolders; }
    public void setSubfolders(List<FolderResponse> subfolders) { this.subfolders = subfolders; }

    public List<FileItemResponse> getFiles() { return files; }
    public void setFiles(List<FileItemResponse> files) { this.files = files; }

    public StorageInfoResponse getStorageInfo() { return storageInfo; }
    public void setStorageInfo(StorageInfoResponse storageInfo) { this.storageInfo = storageInfo; }
}
