package com.example.vault_drive.dto;

public class MoveRequest {
    private Long targetFolderId;

    public MoveRequest() {}

    public MoveRequest(Long targetFolderId) {
        this.targetFolderId = targetFolderId;
    }

    public Long getTargetFolderId() { return targetFolderId; }
    public void setTargetFolderId(Long targetFolderId) { this.targetFolderId = targetFolderId; }
}
