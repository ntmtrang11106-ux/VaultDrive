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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityMetricsFilter extends OncePerRequestFilter {

    private final MeterRegistry meterRegistry;
    private final SecurityLogRepository securityLogRepository;

    // Bộ đếm DDoS (Rate Limiting)
    private final Map<String, AtomicInteger> normalRequestCounts = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> uploadRequestCounts = new ConcurrentHashMap<>();
    private volatile long windowStart = System.currentTimeMillis();

    // Đồng bộ ID Grafana
    private final Set<Long> syncedIds = ConcurrentHashMap.newKeySet();
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // Regex tối ưu (Chống bắt nhầm tên file)
    private static final Pattern SQLI_PATTERN = Pattern.compile(
            "(?i)('|\"|%27)\\s*(or|and)\\s*('|\"|%27|\\d+\\s*=\\s*\\d+)|union\\s+(all\\s+)?select\\b|;\\s*(drop|delete|update|insert)\\b|'\\s*--|xp_cmdshell"
    );
    private static final Pattern XSS_PATTERN = Pattern.compile(
            "(?i)<\\s*script\\b|javascript\\s*:|on(error|load|click|mouseover|submit|focus)\\s*=|<\\s*iframe\\b|<\\s*svg\\b[^>]*onload|document\\.cookie|alert\\s*\\(\\s*['\"\\d]"
    );
    private static final Pattern PATH_TRAVERSAL_PATTERN = Pattern.compile(
            "(?i)(\\.\\./|\\.\\.\\\\|/etc/passwd|c:\\\\windows|boot\\.ini)"
    );

    public SecurityMetricsFilter(MeterRegistry meterRegistry, SecurityLogRepository securityLogRepository) {
        this.meterRegistry = meterRegistry;
        this.securityLogRepository = securityLogRepository;
    }

    @PostConstruct
    public void restoreLogsFromDatabase() {
        try {
            List<SecurityLog> logs = securityLogRepository.findAll();
            for (SecurityLog log : logs) {
                if (log.getId() != null && !syncedIds.add(log.getId())) continue;
                String tStr = log.getDetectedAt() != null ? log.getDetectedAt().format(TIME_FMT) : LocalDateTime.now().format(TIME_FMT);
                Counter.builder("vaultdrive_security_events_total")
                        .tag("detected_at", tStr).tag("ip", log.getIp())
                        .tag("type", log.getType()).tag("action", log.getAction()).tag("severity", log.getSeverity())
                        .register(meterRegistry).increment();
            }
        } catch (Exception e) {
            System.err.println("Không thể khôi phục log: " + e.getMessage());
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (uri.startsWith("/actuator")) {
            restoreLogsFromDatabase();
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = extractClientIp(request);

        // 1. KIỂM TRA CHỐNG TẤN CÔNG DDOS
        long now = System.currentTimeMillis();
        if (now - windowStart > 10_000) {
            normalRequestCounts.clear();
            uploadRequestCounts.clear();
            windowStart = now;
        }

        if (isHighFrequencyUploadEndpoint(uri)) {
            int uploadReqs = uploadRequestCounts.computeIfAbsent(clientIp, k -> new AtomicInteger(0)).incrementAndGet();
            if (uploadReqs > 3000) {
                if (uploadReqs == 3001) recordSecurityEvent(clientIp, "HTTP Flood (DDoS)", "Giới hạn tốc độ", "TRUNG BÌNH");
                blockRequest(response, 429, "Cảnh báo: Tốc độ tải tệp vượt ngưỡng tối đa (3000 req/10s)!");
                return;
            }
        } else {
            int normalReqs = normalRequestCounts.computeIfAbsent(clientIp, k -> new AtomicInteger(0)).incrementAndGet();
            if (normalReqs > 40) {
                if (normalReqs == 41) recordSecurityEvent(clientIp, "HTTP Flood (DDoS)", "Giới hạn tốc độ", "TRUNG BÌNH");
                blockRequest(response, 429, "Cảnh báo: Phát hiện truy cập bất thường (HTTP Flood)!");
                return;
            }
        }

        // 2. BỌC REQUEST JSON (Không bọc chunk)
        HttpServletRequest requestToProcess = request;
        String bodyPayload = "";
        String contentType = request.getContentType();
        int contentLength = request.getContentLength();

        if (!uri.contains("/chunk") && contentType != null &&
                (contentType.contains("application/json") || contentType.contains("application/x-www-form-urlencoded")) &&
                contentLength > 0 && contentLength < 65536) {
            CachedBodyHttpServletRequest wrappedRequest = new CachedBodyHttpServletRequest(request);
            bodyPayload = wrappedRequest.getCachedBodyAsString();
            requestToProcess = wrappedRequest;
        }

        String rawQuery = request.getQueryString() != null ? request.getQueryString() : "";
        String combinedRaw = uri + "?" + rawQuery + " " + bodyPayload;
        String decodedPayload;
        try {
            decodedPayload = URLDecoder.decode(combinedRaw, StandardCharsets.UTF_8);
        } catch (Exception e) {
            decodedPayload = combinedRaw;
        }

        // 3. WAF: BẮT MÃ ĐỘC VÀ CHẶN REQUEST (Nhưng không khóa IP vĩnh viễn)
        if (PATH_TRAVERSAL_PATTERN.matcher(decodedPayload).find()) {
            recordSecurityEvent(clientIp, "Path Traversal", "Chặn gói tin", "NGHIÊM TRỌNG");
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN, "Cảnh báo SOC: Phát hiện truy cập tệp tin trái phép (Path Traversal)!");
            return;
        }
        if (SQLI_PATTERN.matcher(decodedPayload).find()) {
            recordSecurityEvent(clientIp, "SQLi", "Chặn bởi tường lửa", "CAO");
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN, "Cảnh báo SOC: Phát hiện mã độc SQL Injection!");
            return;
        }
        if (XSS_PATTERN.matcher(decodedPayload).find()) {
            recordSecurityEvent(clientIp, "XSS", "Chặn bởi tường lửa", "CAO");
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN, "Cảnh báo SOC: Phát hiện mã độc XSS!");
            return;
        }

        filterChain.doFilter(requestToProcess, response);
    }

    private boolean isHighFrequencyUploadEndpoint(String uri) {
        return uri.startsWith("/api/uploads") || uri.startsWith("/api/files/upload") || uri.startsWith("/api/folders") || uri.contains("/chunk");
    }

    private void recordSecurityEvent(String ip, String type, String action, String severity) {
        LocalDateTime now = LocalDateTime.now();
        try {
            SecurityLog log = new SecurityLog(ip, type, action, severity);
            log.setDetectedAt(now);
            SecurityLog saved = securityLogRepository.save(log);
            if (saved.getId() != null) syncedIds.add(saved.getId());
        } catch (Exception e) {
            System.err.println("Lỗi lưu DB: " + e.getMessage());
        }
        Counter.builder("vaultdrive_security_events_total")
                .tag("detected_at", now.format(TIME_FMT)).tag("ip", ip)
                .tag("type", type).tag("action", action).tag("severity", severity)
                .register(meterRegistry).increment();
    }

    private void blockRequest(HttpServletResponse response, int statusCode, String message) throws IOException {
        response.setStatus(statusCode);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(String.format("{\"status\": %d, \"error\": \"%s\"}", statusCode, message));
        response.getWriter().flush();
    }

    private String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        return request.getRemoteAddr();
    }
}