/**
 * Module Giám sát An ninh & Hiệu năng (SOC)
 * Giữ nguyên kiến trúc: frontend/views/soc.html + frontend/css/soc.css + frontend/js/soc.js
 */
(function () {
  const TIME_RANGES = ['now-5m', 'now-15m', 'now-30m', 'now-1h', 'now-6h', 'now-24h'];
  let pollInterval = null;
  let resolvedDashboardPath = '/soc/d/vaultdrive-soc-main/vaultdrive-soc-and-performance-dashboard';

  // 1. Tự động hỏi Grafana đường dẫn thực tế của Dashboard để không bao giờ bị "Dashboard not found"
  async function resolveGrafanaDashboardUrl() {
    try {
      const res = await fetch('/soc/api/search?type=dash-db');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0 && list[0].url) {
          resolvedDashboardPath = list[0].url.startsWith('/soc') ? list[0].url : '/soc' + list[0].url;
        }
      }
    } catch (e) {
      console.warn('Dùng URL Grafana mặc định:', resolvedDashboardPath);
    }
  }

  // 2. Hàm ẩn sạch giao diện "Tệp của tôi" và hiển thị mảnh views/soc.html
  async function openSocView() {
    const socContainer = document.getElementById('soc-view-container');
    if (!socContainer) return;

    // Ẩn toàn bộ các phần tử của tab "Tệp của tôi" / "Thùng rác" / "Cài đặt"
    document.querySelectorAll('#content-area .section-title').forEach(el => (el.style.display = 'none'));
    const gridFolders = document.querySelector('.grid-folders');
    const gridFiles = document.querySelector('.grid-files');
    const trashView = document.getElementById('trash-view-container');
    const settingsView = document.getElementById('settings-view-container');

    if (gridFolders) gridFolders.style.display = 'none';
    if (gridFiles) gridFiles.style.display = 'none';
    if (trashView) trashView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';

    // Ẩn thanh công cụ Grid/List và ô tìm kiếm tệp không cần thiết khi ở màn hình SOC
    const viewToggle = document.querySelector('.view-toggle, .header-actions');
    if (viewToggle) viewToggle.style.visibility = 'hidden';

    socContainer.style.display = 'block';

    // Lazy-load nội dung từ file frontend/views/soc.html vào trong khung dashboard.html
    if (socContainer.innerHTML.trim() === '') {
      await resolveGrafanaDashboardUrl();
      const resp = await fetch('views/soc.html');
      if (resp.ok) {
        socContainer.innerHTML = await resp.text();
        bindSocEvents();
        updateGrafanaIframe('now-5m');
      }
    }

    // Đổi chữ "Tệp của tôi" trên thanh Header thành "Trung tâm Giám sát An ninh (SOC)"
    const breadcrumb = document.getElementById('breadcrumb-container');
    if (breadcrumb) {
      breadcrumb.innerHTML = '<span class="current">Trung tâm Giám sát An ninh (SOC)</span>';
    }
    document.title = 'Giám sát An ninh (SOC) - VaultDrive';

    fetchPrometheusMetrics();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(fetchPrometheusMetrics, 5000);
  }

  // 3. Gắn sự kiện cho bộ chọn thời gian (Last 5 minutes...)
  function bindSocEvents() {
    const selectEl = document.getElementById('socTimeRangeSelect');
    const prevBtn = document.getElementById('socTimePrevBtn');
    const nextBtn = document.getElementById('socTimeNextBtn');
    const refreshBtn = document.getElementById('socRefreshBtn');

    if (selectEl) {
      selectEl.addEventListener('change', () => {
        updateGrafanaIframe(selectEl.value);
        fetchPrometheusMetrics();
      });
    }

    if (prevBtn && selectEl) {
      prevBtn.addEventListener('click', () => {
        let idx = TIME_RANGES.indexOf(selectEl.value);
        if (idx < TIME_RANGES.length - 1) {
          selectEl.value = TIME_RANGES[idx + 1];
          updateGrafanaIframe(selectEl.value);
        }
      });
    }

    if (nextBtn && selectEl) {
      nextBtn.addEventListener('click', () => {
        let idx = TIME_RANGES.indexOf(selectEl.value);
        if (idx > 0) {
          selectEl.value = TIME_RANGES[idx - 1];
          updateGrafanaIframe(selectEl.value);
        }
      });
    }

    if (refreshBtn && selectEl) {
      refreshBtn.addEventListener('click', () => {
        updateGrafanaIframe(selectEl.value);
        fetchPrometheusMetrics();
      });
    }
  }

  function updateGrafanaIframe(fromRange) {
    const iframe = document.getElementById('socGrafanaIframe');
    if (iframe) {
      iframe.src = `${resolvedDashboardPath}?orgId=1&from=${fromRange}&to=now&timezone=browser&refresh=5s&theme=light&kiosk`;
    }
  }

  // 4. Đọc chỉ số từ /actuator/prometheus để cập nhật 4 thẻ KPI
  async function fetchPrometheusMetrics() {
    try {
      const res = await fetch('/actuator/prometheus');
      if (!res.ok) return;
      const text = await res.text();

      let totalBlocked = 0, sqli = 0, xss = 0, path = 0, ddos = 0, httpReqs = 0;
      const ipMalicious = {};

      for (const line of text.split('\n')) {
        if (line.startsWith('vaultdrive_security_events_total{')) {
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
        if (line.startsWith('http_server_requests_seconds_count{') && !line.includes('/actuator')) {
          const val = parseFloat(line.trim().split(/\s+/).pop());
          if (!isNaN(val)) httpReqs += val;
        }
      }

      const blacklistedCount = Object.values(ipMalicious).filter(v => v >= 5).length;
      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      setTxt('socTotalBlocked', Math.round(totalBlocked).toLocaleString('vi-VN'));
      setTxt('socCntSqli', Math.round(sqli));
      setTxt('socCntXss', Math.round(xss));
      setTxt('socCntPath', Math.round(path));
      setTxt('socCntDdos', Math.round(ddos));
      setTxt('socBlacklistedIps', blacklistedCount + ' IP');
      setTxt('socTotalRequests', Math.round(httpReqs).toLocaleString('vi-VN') + ' req');
    } catch (e) {}
  }

  // 5. Gắn mục "Giám sát SOC" vào Sidebar và TỰ ĐỘNG HIỆN LUÔN MÀN HÌNH SOC KHI ADMIN ĐĂNG NHẬP
  const waitSidebar = setInterval(() => {
    const sidebar = document.getElementById('sidebar-container');
    const navMenu = document.getElementById('main-nav-menu');
    if (sidebar && navMenu && !document.getElementById('nav-soc-btn')) {
      clearInterval(waitSidebar);

      const userRole = localStorage.getItem('user_role');

      // Nếu là User thường thì dừng luôn, không hiện mục SOC
      if (userRole !== 'ROLE_ADMIN') {
        return;
      }

      // Tạo mục menu "Giám sát SOC" đúng chuẩn thẻ <li class="nav-item"> của #main-nav-menu
      const socItem = document.createElement('li');
      socItem.id = 'nav-soc-btn';
      socItem.className = 'nav-item';
      socItem.style.cursor = 'pointer';
      socItem.innerHTML = '<i class="ph-fill ph-shield-check"></i><span>Giám sát SOC</span>';

      // Đưa mục Giám sát SOC lên ĐẦU TIÊN của menu khi đăng nhập bằng Admin
      navMenu.insertBefore(socItem, navMenu.firstChild);

      socItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navMenu.querySelectorAll('.nav-item').forEach(el => {
          el.classList.remove('active');
          const ic = el.querySelector('i');
          if (ic && ic.classList.contains('ph-fill')) {
            ic.classList.remove('ph-fill');
            ic.classList.add('ph');
          }
        });
        socItem.classList.add('active');
        const socIcon = socItem.querySelector('i');
        if (socIcon) {
          socIcon.classList.remove('ph');
          socIcon.classList.add('ph-fill');
        }
        openSocView();
      });

      // Khi Admin bấm sang các tab khác (Tệp của tôi, Thùng rác, Cài đặt) thì ẩn SOC đi để xem tệp
      navMenu.addEventListener('click', (e) => {
        const clickedItem = e.target.closest('.nav-item');
        if (!clickedItem || clickedItem.id === 'nav-soc-btn') return;

        socItem.classList.remove('active');
        const socIcon = socItem.querySelector('i');
        if (socIcon) {
          socIcon.classList.remove('ph-fill');
          socIcon.classList.add('ph');
        }
        const socContainer = document.getElementById('soc-view-container');
        if (socContainer) socContainer.style.display = 'none';
        const viewToggle = document.querySelector('.view-toggle, .header-actions');
        if (viewToggle) viewToggle.style.visibility = 'visible';
        if (pollInterval) clearInterval(pollInterval);
      });

      // NGAY KHI ADMIN VỪA ĐĂNG NHẬP VÀO: Bật thẳng màn hình Giám sát SOC (đè lên loadDashboardData('home'))
      const activateAdminSocImmediately = () => {
        navMenu.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        socItem.classList.add('active');
        openSocView();
      };

      activateAdminSocImmediately();
      // Gọi bồi thêm 1 nhịp sau 300ms để thắng tuyệt đối hàm loadDashboardData('home') của dashboard.js
      setTimeout(activateAdminSocImmediately, 300);
    }
  }, 100);
})();