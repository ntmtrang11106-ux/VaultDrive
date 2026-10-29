package com.example.vault_drive.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "security_logs")
public class SecurityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String ip;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(nullable = false, length = 128)
    private String action;

    @Column(nullable = false, length = 64)
    private String severity;

    @Column(nullable = false)
    private LocalDateTime detectedAt;

    public SecurityLog() {}

    public SecurityLog(String ip, String type, String action, String severity) {
        this.ip = ip;
        this.type = type;
        this.action = action;
        this.severity = severity;
        this.detectedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getIp() { return ip; }
    public String getType() { return type; }
    public String getAction() { return action; }
    public String getSeverity() { return severity; }
    public LocalDateTime getDetectedAt() { return detectedAt; }
}