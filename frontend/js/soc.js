/**
 * Module Giám sát An ninh & Hiệu năng (SOC)
 * Giữ nguyên kiến trúc: frontend/views/soc.html + frontend/css/soc.css + frontend/js/soc.js
 */
(function () {
  const TIME_RANGES = [
    "now-5m",
    "now-15m",
    "now-30m",
    "now-1h",
    "now-6h",
    "now-24h",
  ];
  var pollInterval = null;

  // Hỗ trợ cả khi chạy trực tiếp qua VS Code Live Server (port 5500) lẫn Nginx Reverse Proxy (port 80)
  var isLiveServer = window.location.port === "5500";
  var GRAFANA_BASE = isLiveServer ? "http://localhost:3000" : "";
  var PROMETHEUS_BASE = isLiveServer ? "http://localhost:8080" : "";
  var resolvedDashboardPath = `${GRAFANA_BASE}/soc/d/vaultdrive-soc-main/vaultdrive-soc-and-performance-dashboard`;

  // 1. Tự động hỏi Grafana đường dẫn thực tế của Dashboard để không bao giờ bị "Dashboard not found"
  async function resolveGrafanaDashboardUrl() {
    try {
      const res = await fetch(`${GRAFANA_BASE}/soc/api/search?type=dash-db`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0 && list[0].url) {
          const path = list[0].url.startsWith("/soc")
            ? list[0].url
            : "/soc" + list[0].url;
          resolvedDashboardPath = `${GRAFANA_BASE}${path}`;
        }
      }
    } catch (e) {
      console.warn("Dùng URL Grafana mặc định:", resolvedDashboardPath);
    }
  }

  // 2. Hàm ẩn sạch giao diện "Tệp của tôi" và hiển thị mảnh views/soc.html
  async function openSocView() {
    window.currentViewType = "soc";
    const socContainer = document.getElementById("soc-view-container");
    if (!socContainer) return;

    // Ẩn toàn bộ các phần tử của tab "Tệp của tôi" / "Thùng rác" / "Cài đặt"
    document
      .querySelectorAll("#content-area .section-title")
      .forEach((el) => (el.style.display = "none"));
    const gridFolders = document.querySelector(".grid-folders");
    const gridFiles = document.querySelector(".grid-files");
    const trashView = document.getElementById("trash-view-container");
    const settingsView = document.getElementById("settings-view-container");

    if (gridFolders) gridFolders.style.display = "none";
    if (gridFiles) gridFiles.style.display = "none";
    if (trashView) trashView.style.display = "none";
    if (settingsView) settingsView.style.display = "none";

    // Đảm bảo phần hành động trên header (thông báo, avatar Admin) luôn luôn hiển thị
    const headerActions = document.querySelector(".header-actions");
    if (headerActions) headerActions.style.visibility = "visible";
    const topProfile = document.getElementById("adminTopProfile");
    if (topProfile && document.body.classList.contains("admin-mode")) {
      topProfile.style.display = "inline-flex";
    }

    socContainer.style.display = "block";

    // Lazy-load nội dung từ file frontend/views/soc.html vào trong khung dashboard.html
    if (socContainer.innerHTML.trim() === "") {
      await resolveGrafanaDashboardUrl();
      const resp = await fetch("views/soc.html");
      if (resp.ok) {
        socContainer.innerHTML = await resp.text();
        bindSocEvents();
        updateGrafanaIframe("now-5m");
      }
    }

    // Cập nhật Header cho Admin (Hiển thị Logo có sẵn trong layout.html)
    const adminLogo = document.getElementById("adminLogoArea");
    if (adminLogo) adminLogo.style.display = "flex";
    const breadcrumb = document.getElementById("breadcrumb-container");
    if (breadcrumb) {
      breadcrumb.innerHTML = '<span class="current">Giám sát SOC</span>';
    }
    document.title = "Quản trị An ninh SOC - VaultDrive";

    fetchPrometheusMetrics();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(fetchPrometheusMetrics, 5000);
  }

  // 3. Gắn sự kiện cho bộ chọn thời gian (Last 5 minutes...)
  function bindSocEvents() {
    const selectEl = document.getElementById("socTimeRangeSelect");
    const prevBtn = document.getElementById("socTimePrevBtn");
    const nextBtn = document.getElementById("socTimeNextBtn");
    const refreshBtn = document.getElementById("socRefreshBtn");

    if (selectEl) {
      selectEl.addEventListener("change", () => {
        updateGrafanaIframe(selectEl.value);
        fetchPrometheusMetrics();
      });
    }

    if (prevBtn && selectEl) {
      prevBtn.addEventListener("click", () => {
        let idx = TIME_RANGES.indexOf(selectEl.value);
        if (idx < TIME_RANGES.length - 1) {
          selectEl.value = TIME_RANGES[idx + 1];
          updateGrafanaIframe(selectEl.value);
        }
      });
    }

    if (nextBtn && selectEl) {
      nextBtn.addEventListener("click", () => {
        let idx = TIME_RANGES.indexOf(selectEl.value);
        if (idx > 0) {
          selectEl.value = TIME_RANGES[idx - 1];
          updateGrafanaIframe(selectEl.value);
        }
      });
    }

    if (refreshBtn && selectEl) {
      refreshBtn.addEventListener("click", () => {
        updateGrafanaIframe(selectEl.value);
        fetchPrometheusMetrics();
      });
    }
  }

  function updateGrafanaIframe(fromRange) {
    const iframe = document.getElementById("socGrafanaIframe");
    if (iframe) {
      iframe.src = `${resolvedDashboardPath}?orgId=1&from=${fromRange}&to=now&timezone=browser&refresh=5s&theme=light&kiosk`;
    }
  }

  // 4. Đọc chỉ số từ /actuator/prometheus để cập nhật 4 thẻ KPI
  async function fetchPrometheusMetrics() {
    try {
      const res = await fetch(`${PROMETHEUS_BASE}/actuator/prometheus`);
      if (!res.ok) return;
      const text = await res.text();

      let totalBlocked = 0,
        sqli = 0,
        xss = 0,
        path = 0,
        ddos = 0,
        httpReqs = 0;
      const ipMalicious = {};

      for (const line of text.split("\n")) {
        if (line.startsWith("vaultdrive_security_events_total{")) {
          const val = parseFloat(line.trim().split(/\s+/).pop());
          if (!isNaN(val)) {
            totalBlocked += val;
            if (line.includes('type="SQLi"')) sqli += val;
            if (line.includes('type="XSS"')) xss += val;
            if (line.includes('type="Path Traversal"')) path += val;
            if (line.includes('type="HTTP Flood (DDoS)"')) ddos += val;

            if (!line.includes('type="HTTP Flood (DDoS)"')) {
              const m = line.match(/ip="([^"]+)"/);
              if (m && m[1]) ipMalicious[m[1]] = (ipMalicious[m[1]] || 0) + val;
            }
          }
        }
        if (
          line.startsWith("http_server_requests_seconds_count{") &&
          !line.includes("/actuator")
        ) {
          const val = parseFloat(line.trim().split(/\s+/).pop());
          if (!isNaN(val)) httpReqs += val;
        }
      }

      const blacklistedCount = Object.values(ipMalicious).filter(
        (v) => v >= 5,
      ).length;
      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      setTxt(
        "socTotalBlocked",
        Math.round(totalBlocked).toLocaleString("vi-VN"),
      );
      setTxt("socCntSqli", Math.round(sqli));
      setTxt("socCntXss", Math.round(xss));
      setTxt("socCntPath", Math.round(path));
      setTxt("socCntDdos", Math.round(ddos));
      setTxt("socBlacklistedIps", blacklistedCount + " IP");
      setTxt(
        "socTotalRequests",
        Math.round(httpReqs).toLocaleString("vi-VN") + " req",
      );
    } catch (e) { }
  }

  window.openSocView = openSocView;

  // 5. THIẾT LẬP CHẾ ĐỘ ADMIN: ẨN HOÀN TOÀN SIDEBAR, ĐƯA AVATAR & ĐĂNG XUẤT LÊN TOPBAR
  const initAdminMode = () => {
    var role = localStorage.getItem('user_role');
    var isSoc = window.location.search.includes('tab=soc');
    if (role !== 'ROLE_ADMIN' && !isSoc) return;

    // Kích hoạt class admin-mode trên body để ẩn sạch Sidebar
    document.body.classList.add('admin-mode');

    // Mở màn hình SOC toàn màn hình
    openSocView();

    // 1. Menu: Cài đặt (Mở giao diện settings-view)
    const openAdminSettingsView = async () => {
      const dropdown = document.getElementById('adminProfileDropdown');
      if (dropdown) dropdown.classList.remove('show');
      const socContainer = document.getElementById('soc-view-container');
      if (socContainer) socContainer.style.display = 'none';
      if (pollInterval) clearInterval(pollInterval);

      const settingsContainer = document.getElementById('settings-view-container');
      if (settingsContainer) {
        if (settingsContainer.innerHTML.trim() === '') {
          try {
            const res = await fetch('views/settings-view.html');
            if (res.ok) {
              settingsContainer.innerHTML = await res.text();
            }
          } catch (err) {
            console.error('Lỗi tải settings view:', err);
          }
        }
        settingsContainer.style.display = 'block';

        if (typeof loadUserProfile === 'function') {
          loadUserProfile();
        }

        // Cập nhật thông tin Admin lên Settings card
        const adminEmail = localStorage.getItem('user_email') || 'admin@vaultdrive.com';
        const adminName = adminEmail.split('@')[0];
        const sFullName = document.getElementById('settingsFullName');
        const sEmail = document.getElementById('settingsEmail');
        const sAvatar = document.getElementById('settingsAvatar');
        const inFullName = document.getElementById('inputFullName');
        const inEmail = document.getElementById('inputEmail');
        if (sFullName && (!sFullName.textContent || sFullName.textContent === 'Đang tải...')) sFullName.textContent = 'Quản trị viên (' + adminName + ')';
        if (sEmail && (!sEmail.textContent || sEmail.textContent === '...')) sEmail.textContent = adminEmail;
        if (sAvatar && (!sAvatar.textContent || sAvatar.textContent === 'TM')) sAvatar.textContent = 'AD';
        if (inFullName && !inFullName.value) inFullName.value = 'System Administrator';
        if (inEmail && !inEmail.value) inEmail.value = adminEmail;

        const adminLogo = document.getElementById("adminLogoArea");
        if (adminLogo) {
          adminLogo.style.display = "flex";
        }

        const breadcrumb = document.getElementById('breadcrumb-container');
        if (breadcrumb) {
          breadcrumb.innerHTML = `
            <a href="#" class="breadcrumb-link" id="adminBreadcrumbSoc">Giám sát SOC</a>
            <i class="ph ph-caret-right" style="font-size: 13px; margin: 0 8px; color: #94a3b8;"></i>
            <span class="current">Cài đặt</span>
          `;
        }
        document.title = "Cài đặt - VaultDrive";
      }
    };

    // Sự kiện toàn cục (Event Delegation) cho Avatar và Menu Admin
    document.addEventListener('click', (e) => {
      // Bấm vào Logo hoặc Breadcrumb "Giám sát SOC" để quay lại SOC
      if (e.target.closest('#adminBreadcrumbSoc') || e.target.closest('#adminLogoArea')) {
        const settingsContainer = document.getElementById('settings-view-container');
        if (settingsContainer && settingsContainer.style.display !== 'none') {
          e.preventDefault();
          settingsContainer.style.display = 'none';
          openSocView();
          return;
        }
      }

      const avatarBtn = e.target.closest('#adminAvatarBtn');
      const dropdown = document.getElementById('adminProfileDropdown');

      if (avatarBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (dropdown) dropdown.classList.toggle('show');
        return;
      }

      if (e.target.closest('#adminMenuSettings')) {
        e.preventDefault();
        if (dropdown) dropdown.classList.remove('show');
        openAdminSettingsView();
        return;
      }

      if (e.target.closest('#adminMenuLogout')) {
        e.preventDefault();
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_email');
        window.location.href = 'login.html';
        return;
      }

      if (dropdown && !e.target.closest('#adminTopProfile')) {
        dropdown.classList.remove('show');
      }
    });

    // Chờ top-header được load từ layout.js để gán thông tin Admin Profile
    const waitHeader = setInterval(() => {
      const topProfile = document.getElementById('adminTopProfile');
      if (topProfile) {
        clearInterval(waitHeader);
        topProfile.style.setProperty('display', 'inline-flex', 'important');

        // Lấy thông tin admin
        const adminEmail = localStorage.getItem('user_email') || 'admin@vaultdrive.com';
        const adminName = adminEmail.split('@')[0];
        const topNameEl = document.getElementById('adminTopName');
        const dropNameEl = document.getElementById('adminDropdownName');
        const dropEmailEl = document.getElementById('adminDropdownEmail');

        if (topNameEl) topNameEl.textContent = adminName;
        if (dropNameEl) dropNameEl.textContent = 'Quản trị viên (' + adminName + ')';
        if (dropEmailEl) dropEmailEl.textContent = adminEmail;
      }
    }, 50);
  };

  initAdminMode();
})();
