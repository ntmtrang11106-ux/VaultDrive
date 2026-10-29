package com.example.vault_drive.security;

import com.example.vault_drive.entity.SecurityLog;
import com.example.vault_drive.repository.SecurityLogRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityMetricsFilter extends OncePerRequestFilter {

    private final MeterRegistry meterRegistry;
    private final SecurityLogRepository securityLogRepository;

    private final Map<String, AtomicInteger> requestCounts = new ConcurrentHashMap<>();
    private volatile long windowStart = System.currentTimeMillis();
    private static final int DDOS_THRESHOLD = 30;

    public SecurityMetricsFilter(MeterRegistry meterRegistry, SecurityLogRepository securityLogRepository) {
        this.meterRegistry = meterRegistry;
        this.securityLogRepository = securityLogRepository;
    }

    // Khi khởi động lại Server: Đọc toàn bộ lịch sử tấn công THẬT đã lưu trong SQL Server nạp lên lại Prometheus
    @PostConstruct
    public void restoreLogsFromDatabase() {
        List<SecurityLog> savedLogs = securityLogRepository.findAll();
        for (SecurityLog log : savedLogs) {
            incrementPrometheusCounter(log.getIp(), log.getType(), log.getAction(), log.getSeverity(), 1);
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (uri.startsWith("/actuator")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);

        // 1. Kiểm tra HTTP Flood (DDoS)
        long now = System.currentTimeMillis();
        if (now - windowStart > 10_000) {
            requestCounts.clear();
            windowStart = now;
        }
        int currentReq = requestCounts.computeIfAbsent(clientIp, k -> new AtomicInteger(0)).incrementAndGet();
        if (currentReq > DDOS_THRESHOLD) {
            logAndRecordAttack(clientIp, "HTTP Flood (DDoS)", "Chặn IP tạm thời", "NGHIÊM TRỌNG");
        }

        String rawQuery = request.getQueryString() != null ? request.getQueryString() : "";
        String fullUrl = uri + "?" + rawQuery;
        String decodedPayload;
        try {
            decodedPayload = URLDecoder.decode(fullUrl, StandardCharsets.UTF_8).toLowerCase();
        } catch (Exception e) {
            decodedPayload = fullUrl.toLowerCase();
        }

        // 2. Phát hiện SQLi
        if (decodedPayload.contains("' or ") || decodedPayload.contains("1=1") ||
            decodedPayload.contains("union select") || decodedPayload.contains("--") ||
            decodedPayload.contains("drop table")) {
            logAndRecordAttack(clientIp, "SQLi", "Chặn bởi tường lửa", "CAO");
        }

        // 3. Phát hiện XSS
        if (decodedPayload.contains("<script") || decodedPayload.contains("javascript:") ||
            decodedPayload.contains("onerror=") || decodedPayload.contains("onload=") ||
            decodedPayload.contains("alert(")) {
            logAndRecordAttack(clientIp, "XSS", "Giới hạn tốc độ", "TRUNG BÌNH");
        }

        // 4. Phát hiện Path Traversal
        if (decodedPayload.contains("../") || decodedPayload.contains("..\\") ||
            decodedPayload.contains("/etc/passwd") || decodedPayload.contains("c:\\windows")) {
            logAndRecordAttack(clientIp, "Path Traversal", "Chặn bởi tường lửa", "TRUNG BÌNH");
        }

        filterChain.doFilter(request, response);
    }

    // Vừa lưu vào bảng security_logs trong SQL Server, vừa tăng bộ đếm Prometheus
    private void logAndRecordAttack(String ip, String type, String action, String severity) {
        securityLogRepository.save(new SecurityLog(ip, type, action, severity));
        incrementPrometheusCounter(ip, type, action, severity, 1);
    }

    private void incrementPrometheusCounter(String ip, String type, String action, String severity, double count) {
        Counter.builder("vaultdrive_security_events")
                .description("Tong so su kien tan cong bao mat phat hien duoc")
                .tag("ip", ip)
                .tag("type", type)
                .tag("action", action)
                .tag("severity", severity)
                .register(meterRegistry)
                .increment(count);
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}