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
    private static final int DDOS_THRESHOLD = 30; // Quá 30 request / 10 giây -> Chặn DDoS

    public SecurityMetricsFilter(MeterRegistry meterRegistry, SecurityLogRepository securityLogRepository) {
        this.meterRegistry = meterRegistry;
        this.securityLogRepository = securityLogRepository;
    }

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

        // 1. KIỂM TRA & CHẶN ĐỨNG HTTP FLOOD (DDoS)
        long now = System.currentTimeMillis();
        if (now - windowStart > 10_000) {
            requestCounts.clear();
            windowStart = now;
        }
        int currentReq = requestCounts.computeIfAbsent(clientIp, k -> new AtomicInteger(0)).incrementAndGet();
        if (currentReq > DDOS_THRESHOLD) {
            logAndRecordAttack(clientIp, "HTTP Flood (DDoS)", "Chặn IP tạm thời", "NGHIÊM TRỌNG");
            blockRequest(response, 429, "Phát hiện tấn công HTTP Flood (DDoS). IP của bạn đã bị tạm khóa!");
            return; // <--- DỪNG NGAY LẬP TỨC, KHÔNG CHO VÀO CONTROLLER
        }

        String rawQuery = request.getQueryString() != null ? request.getQueryString() : "";
        String fullUrl = uri + "?" + rawQuery;
        String decodedPayload;
        try {
            decodedPayload = URLDecoder.decode(fullUrl, StandardCharsets.UTF_8).toLowerCase();
        } catch (Exception e) {
            decodedPayload = fullUrl.toLowerCase();
        }

        // 2. KIỂM TRA & CHẶN ĐỨNG SQL INJECTION (SQLi)
        if (decodedPayload.contains("' or ") || decodedPayload.contains("1=1") ||
            decodedPayload.contains("union select") || decodedPayload.contains("--") ||
            decodedPayload.contains("drop table")) {
            logAndRecordAttack(clientIp, "SQLi", "Chặn bởi tường lửa", "CAO");
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN, "Cảnh báo: Phát hiện mã độc SQL Injection! Yêu cầu bị chặn bởi tường lửa.");
            return; // <--- DỪNG NGAY LẬP TỨC
        }

        // 3. KIỂM TRA & CHẶN ĐỨNG XSS
        if (decodedPayload.contains("<script") || decodedPayload.contains("javascript:") ||
            decodedPayload.contains("onerror=") || decodedPayload.contains("onload=") ||
            decodedPayload.contains("alert(")) {
            logAndRecordAttack(clientIp, "XSS", "Giới hạn tốc độ", "TRUNG BÌNH");
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN, "Cảnh báo: Phát hiện mã độc XSS! Yêu cầu bị chặn bởi tường lửa.");
            return; // <--- DỪNG NGAY LẬP TỨC
        }

        // 4. KIỂM TRA & CHẶN ĐỨNG PATH TRAVERSAL
        if (decodedPayload.contains("../") || decodedPayload.contains("..\\") ||
            decodedPayload.contains("/etc/passwd") || decodedPayload.contains("c:\\windows")) {
            logAndRecordAttack(clientIp, "Path Traversal", "Chặn bởi tường lửa", "TRUNG BÌNH");
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN, "Cảnh báo: Phát hiện truy cập trái phép Path Traversal! Yêu cầu bị chặn.");
            return; // <--- DỪNG NGAY LẬP TỨC
        }

        // Nếu request hoàn toàn sạch sẽ (không dính 4 lỗi trên) thì mới cho đi tiếp vào trong:
        filterChain.doFilter(request, response);
    }

    // Hàm trả về thông báo lỗi JSON tiếng Việt cho kẻ tấn công và đóng kết nối
    private void blockRequest(HttpServletResponse response, int statusCode, String message) throws IOException {
        response.setStatus(statusCode);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"status\": " + statusCode + ", \"error\": \"" + message + "\"}");
        response.getWriter().flush();
    }

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