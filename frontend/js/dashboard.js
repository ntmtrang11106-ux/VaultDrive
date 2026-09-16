// frontend/js/dashboard.js

// Cấu hình đường dẫn gốc đến Backend API
const API_BASE_URL = "http://localhost:8080/api";

/**
 * Kiểm tra xác thực (Route Protection)
 * Gọi hàm này ngay khi file được nạp để tránh nháy giao diện
 */
function checkAuth() {
  const token = localStorage.getItem("jwt_token");
  if (!token) {
    window.location.href = "login.html";
    return null;
  }
  return token;
}

// Chạy kiểm tra ngay lập tức
checkAuth();

/**
 * Hàm hỗ trợ gọi API có kèm Token xác thực
 */
async function fetchWithAuth(endpoint, options = {}) {
  const token = checkAuth();
  if (!token) return;

  const headers = options.headers ? new Headers(options.headers) : new Headers();

  // Tránh đè Content-Type nếu đang gửi FormData
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Authorization", `Bearer ${token}`);

  const config = {
    ...options,
    headers: headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (response.status === 401 || response.status === 403) {
    // Token không hợp lệ hoặc hết hạn, tự động đăng xuất
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    window.location.href = "login.html";
    throw new Error(`Lỗi xác thực (401/403) từ Backend. Đã chuyển hướng về trang đăng nhập.`);
  }

  return response;
}




/**
 * Xử lý sự kiện chuyển tab (Trang chủ / Tệp của tôi)
 */
function setupTabNavigation() {
  const navItems = document.querySelectorAll('#main-nav-menu .nav-item');
  const breadcrumbContainer = document.getElementById('breadcrumb-container');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Bỏ active tất cả tab
      navItems.forEach(nav => {
        nav.classList.remove('active');
        // Chuyển icon fill thành nét mảnh
        const icon = nav.querySelector('i');
        if (icon && icon.classList.contains('ph-fill')) {
          icon.classList.remove('ph-fill');
          icon.classList.add('ph');
        }
      });

      // Active tab được click
      item.classList.add('active');
      // Chuyển icon nét mảnh thành fill
      const icon = item.querySelector('i');
      if (icon && icon.classList.contains('ph')) {
        icon.classList.remove('ph');
        icon.classList.add('ph-fill');
      }

      const viewType = item.dataset.view; // 'home' hoặc 'my-files' hoặc 'shared'

      // Reset folder navigation state back to root
      window.currentFolderId = null;
      const rootTitle = viewType === 'shared' ? 'Được chia sẻ' :
        viewType === 'trash' ? 'Thùng rác' :
          viewType === 'recent' ? 'Gần đây' : 'Tệp của tôi';
      window.folderPathTrail = [{ id: null, name: rootTitle }];

      // Cập nhật Breadcrumb
      if (typeof updateBreadcrumbUI === 'function') {
        updateBreadcrumbUI();
      } else if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = `<span class="current">${rootTitle}</span>`;
      }

      // Load lại dữ liệu cho tab tương ứng
      loadDashboardData(viewType);
    });
  });
}

/**
 * Xử lý sự kiện đổi chế độ hiển thị (Grid / List)
 */
function setupViewToggle() {
  const gridBtn = document.querySelector('.view-btn i.ph-squares-four')?.parentElement;
  const listBtn = document.querySelector('.view-btn i.ph-list')?.parentElement;
  const contentScroll = document.querySelector('.content-scroll');

  if (gridBtn) {
    gridBtn.addEventListener('click', () => {
      gridBtn.classList.add('active');
      if (listBtn) listBtn.classList.remove('active');
      if (contentScroll) contentScroll.classList.remove('list-view');
      const gridFiles = document.querySelector('.grid-files');
      if (gridFiles) gridFiles.classList.remove('list-view');
      if (window.currentViewType === 'shared' && typeof renderSharedView === 'function') {
        renderSharedView();
      }
    });
  }

  if (listBtn) {
    listBtn.addEventListener('click', () => {
      listBtn.classList.add('active');
      if (gridBtn) gridBtn.classList.remove('active');
      if (contentScroll) contentScroll.classList.add('list-view');
      const gridFiles = document.querySelector('.grid-files');
      if (gridFiles) gridFiles.classList.add('list-view');
      if (window.currentViewType === 'shared' && typeof renderSharedView === 'function') {
        renderSharedView();
      }
    });
  }
}


// Khởi chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  setupTabNavigation();
  setupViewToggle();
  if (typeof setupUploadModal === "function") setupUploadModal();
  if (typeof setupDragAndDrop === "function") setupDragAndDrop();

  // Tạm thời gọi hàm với dữ liệu mẫu (sẽ sửa sau khi backend xong)
  if (typeof loadDashboardData === "function") loadDashboardData('home');

  // Fetch Storage Info
  fetchStorageInfo();

  // Fetch Notifications
  if (typeof fetchNotifications === "function") fetchNotifications();
});

/**
 * Hàm hỗ trợ format kích thước file
 */
function formatSizeGlobal(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Gọi API lấy thông tin dung lượng lưu trữ
 */
async function fetchStorageInfo() {
  try {
    const response = await fetchWithAuth("/dashboard/storage");
    if (response && response.ok) {
      const data = await response.json();
      // Giả sử data: { usedBytes: 1024, maxBytes: 10485760 }
      const usedBytes = data.usedBytes || 0;
      const maxBytes = data.maxBytes || (15 * 1024 * 1024 * 1024); // Mặc định 15GB nếu không có

      const usedStr = formatSizeGlobal(usedBytes);
      const maxStr = formatSizeGlobal(maxBytes);
      const remainingBytes = Math.max(0, maxBytes - usedBytes);
      const remainingStr = formatSizeGlobal(remainingBytes);

      let percent = 0;
      if (maxBytes > 0) {
        percent = Math.round((usedBytes / maxBytes) * 100);
      }

      // Update UI
      const storageValue = document.querySelector('.storage-value');
      const progressFill = document.querySelector('.progress-fill');
      const storageRemaining = document.querySelector('.storage-remaining');

      if (storageValue) storageValue.textContent = `${usedStr} / ${maxStr}`;
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (storageRemaining) storageRemaining.textContent = `${remainingStr} còn lại`;
    }
  } catch (error) {
    console.error("Lỗi lấy thông tin bộ nhớ:", error);
  }
}


