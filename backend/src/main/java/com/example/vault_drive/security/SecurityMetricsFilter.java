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
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityMetricsFilter extends OncePerRequestFilter {

    private final MeterRegistry meterRegistry;
    private final SecurityLogRepository securityLogRepository;

    // Tách riêng 2 bộ đếm tần suất trong khung 10 giây:
    // 1. Bộ đếm cho các API thông thường (Ngưỡng: 60 req / 10s)
    private final Map<String, AtomicInteger> normalRequestCounts = new ConcurrentHashMap<>();
    // 2. Bộ đếm riêng cho luồng Upload Chunk / Thư mục lớn (Ngưỡng: 3000 req / 10s)
    private final Map<String, AtomicInteger> uploadRequestCounts = new ConcurrentHashMap<>();
    private volatile long windowStart = System.currentTimeMillis();

    // Danh sách đen động (Chỉ đếm các lỗi tấn công cố ý: SQLi, XSS, Path Traversal)
    private final Map<String, AtomicInteger> maliciousViolationCounts = new ConcurrentHashMap<>();
    private final Set<String> blacklistedIps = ConcurrentHashMap.newKeySet();
    private static final int BLACKLIST_THRESHOLD = 5;

    public SecurityMetricsFilter(MeterRegistry meterRegistry, SecurityLogRepository securityLogRepository) {
        this.meterRegistry = meterRegistry;
        this.securityLogRepository = securityLogRepository;
    }

    @PostConstruct
    public void restoreLogsFromDatabase() {
        try {
            List<SecurityLog> logs = securityLogRepository.findAll();
            for (SecurityLog log : logs) {
                Counter.builder("vaultdrive_security_events_total")
                        .tag("ip", log.getIp())
                        .tag("type", log.getType())
                        .tag("action", log.getAction())
                        .tag("severity", log.getSeverity())
                        .register(meterRegistry)
                        .increment();

                // Chỉ khôi phục vào Blacklist nếu là tấn công mã độc (Không khóa vĩnh viễn lỗi 429)
                if (!"HTTP Flood (DDoS)".equals(log.getType())) {
                    int violations = maliciousViolationCounts
                            .computeIfAbsent(log.getIp(), k -> new AtomicInteger(0))
                            .incrementAndGet();
                    if (violations >= BLACKLIST_THRESHOLD) {
                        blacklistedIps.add(log.getIp());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Không thể khôi phục log an ninh từ DB: " + e.getMessage());
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();

        // Bỏ qua endpoint nội bộ của Prometheus
        if (uri.startsWith("/actuator")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = extractClientIp(request);

        // 0. KIỂM TRA BLACKLIST ĐỘNG (Khóa vĩnh viễn kẻ tấn công SQLi/XSS/Path Traversal)
        if (blacklistedIps.contains(clientIp)) {
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN,
                    "IP của bạn (" + clientIp + ") đã bị khóa bởi Tường lửa SOC do gửi mã độc nhiều lần!");
            return;
        }

        // 1. KIỂM TRA RATE LIMITING PHÂN TẦNG (Tránh chặn nhầm khi tải thư mục lớn như Longman)
        long now = System.currentTimeMillis();
        if (now - windowStart > 10_000) {
            normalRequestCounts.clear();
            uploadRequestCounts.clear();
            windowStart = now;
        }

        if (isHighFrequencyUploadEndpoint(uri)) {
            // Luồng Upload (init / chunk / complete): Cho phép 3.000 request / 10 giây
            int uploadReqs = uploadRequestCounts.computeIfAbsent(clientIp, k -> new AtomicInteger(0)).incrementAndGet();
            if (uploadReqs > 3000) {
                if (uploadReqs == 3001) {
                    recordSecurityEvent(clientIp, "HTTP Flood (DDoS)", "Giới hạn tốc độ", "TRUNG BÌNH", false);
                }
                blockRequest(response, 429, "Cảnh báo: Tốc độ tải tệp vượt ngưỡng tối đa (3000 req/10s)!");
                return;
            }
        } else {
            // Luồng API thông thường (Login, xem danh sách...): Giới hạn 40 request / 10 giây
            int normalReqs = normalRequestCounts.computeIfAbsent(clientIp, k -> new AtomicInteger(0)).incrementAndGet();
            if (normalReqs > 40) {
                if (normalReqs == 41) {
                    recordSecurityEvent(clientIp, "HTTP Flood (DDoS)", "Giới hạn tốc độ", "TRUNG BÌNH", false);
                }
                blockRequest(response, 429, "Cảnh báo: Phát hiện truy cập bất thường (HTTP Flood - 429 Too Many Requests)!");
                return;
            }
        }

        // 2. BỌC REQUEST ĐỂ QUÉT BODY JSON (Tuyệt đối KHÔNG bọc luồng gửi dữ liệu chunk/multipart)
        HttpServletRequest requestToProcess = request;
        String bodyPayload = "";
        String contentType = request.getContentType();
        int contentLength = request.getContentLength();

        if (!uri.contains("/chunk") && contentType != null &&
                (contentType.contains("application/json") || contentType.contains("application/x-www-form-urlencoded")) &&
                contentLength > 0 && contentLength < 65536) { // Chỉ đọc JSON nhỏ hơn 64KB
            CachedBodyHttpServletRequest wrappedRequest = new CachedBodyHttpServletRequest(request);
            bodyPayload = wrappedRequest.getCachedBodyAsString();
            requestToProcess = wrappedRequest;
        }

        String rawQuery = request.getQueryString() != null ? request.getQueryString() : "";
        String combinedRaw = uri + "?" + rawQuery + " " + bodyPayload;
        String decodedPayload;
        try {
            decodedPayload = URLDecoder.decode(combinedRaw, StandardCharsets.UTF_8).toLowerCase();
        } catch (Exception e) {
            decodedPayload = combinedRaw.toLowerCase();
        }

        // 3. QUÉT PATH TRAVERSAL
        if (containsPathTraversal(decodedPayload)) {
            recordSecurityEvent(clientIp, "Path Traversal", "Chặn IP tạm thời", "NGHIÊM TRỌNG", true);
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN,
                    "Cảnh báo: Phát hiện hành vi truy cập tệp tin trái phép (Path Traversal)!");
            return;
        }

        // 4. QUÉT SQL INJECTION
        if (containsSqlInjection(decodedPayload)) {
            recordSecurityEvent(clientIp, "SQLi", "Chặn bởi tường lửa", "CAO", true);
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN,
                    "Cảnh báo: Phát hiện mã độc SQL Injection!");
            return;
        }

        // 5. QUÉT XSS
        if (containsXss(decodedPayload)) {
            recordSecurityEvent(clientIp, "XSS", "Chặn bởi tường lửa", "CAO", true);
            blockRequest(response, HttpServletResponse.SC_FORBIDDEN,
                    "Cảnh báo: Phát hiện mã độc Cross-Site Scripting (XSS)!");
            return;
        }

        filterChain.doFilter(requestToProcess, response);
    }

    /**
     * Nhận diện các API thuộc luồng tải lên nhiều tệp / chia nhỏ chunk
     * (init, chunk, complete, folders/create-batch...)
     */
    private boolean isHighFrequencyUploadEndpoint(String uri) {
        return uri.startsWith("/api/uploads")
                || uri.startsWith("/api/files/upload")
                || uri.startsWith("/api/folders")
                || uri.contains("/chunk");
    }

    private void recordSecurityEvent(String ip, String type, String action, String severity, boolean countTowardsBlacklist) {
        if (countTowardsBlacklist) {
            int totalMalicious = maliciousViolationCounts
                    .computeIfAbsent(ip, k -> new AtomicInteger(0))
                    .incrementAndGet();
            if (totalMalicious >= BLACKLIST_THRESHOLD) {
                blacklistedIps.add(ip);
            }
        }

        Counter.builder("vaultdrive_security_events_total")
                .tag("ip", ip)
                .tag("type", type)
                .tag("action", action)
                .tag("severity", severity)
                .register(meterRegistry)
                .increment();

        try {
            SecurityLog log = new SecurityLog();
            log.setIp(ip);
            log.setType(type);
            log.setAction(action);
            log.setSeverity(severity);
            log.setDetectedAt(LocalDateTime.now());
            securityLogRepository.save(log);
        } catch (Exception e) {
            System.err.println("Lỗi lưu SecurityLog vào DB: " + e.getMessage());
        }
    }

    private void blockRequest(HttpServletResponse response, int statusCode, String message) throws IOException {
        response.setStatus(statusCode);
        response.setContentType("application/json;charset=UTF-8");
        String json = String.format("{\"status\": %d, \"error\": \"%s\"}", statusCode, message);
        response.getWriter().write(json);
        response.getWriter().flush();
    }

    private String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private boolean containsPathTraversal(String s) {
        return s.contains("../") || s.contains("..\\") || s.contains("/etc/passwd")
                || s.contains("c:\\windows") || s.contains("boot.ini");
    }

    private boolean containsSqlInjection(String s) {
        return s.contains("' or ") || s.contains("'or ") || s.contains("1=1")
                || s.contains("union select") || s.contains("drop table")
                || s.contains("insert into") || s.contains("xp_cmdshell")
                || s.contains("'--") || s.contains("\" or \"");
    }

    private boolean containsXss(String s) {
        return s.contains("<script") || s.contains("javascript:")
                || s.contains("onerror=") || s.contains("onload=")
                || s.contains("alert(") || s.contains("document.cookie");
    }
}