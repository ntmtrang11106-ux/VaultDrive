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

      const viewType = item.dataset.view; // 'home' hoặc 'my-files'

      // Cập nhật Breadcrumb
      if (viewType === 'home') {
        breadcrumbContainer.innerHTML = '<span class="current">Trang chủ</span>';
      } else if (viewType === 'my-files') {
        breadcrumbContainer.innerHTML = '<span class="current">Tệp của tôi</span>';
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
  const gridBtn = document.querySelector('.view-btn i.ph-squares-four').parentElement;
  const listBtn = document.querySelector('.view-btn i.ph-list').parentElement;
  const contentScroll = document.querySelector('.content-scroll');

  gridBtn.addEventListener('click', () => {
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
    contentScroll.classList.remove('list-view');
  });

  listBtn.addEventListener('click', () => {
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
    contentScroll.classList.add('list-view');
  });
}


// Khởi chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  setupTabNavigation();
  setupViewToggle();
  setupUploadModal();
  setupDragAndDrop();
  // Tạm thời gọi hàm với dữ liệu mẫu. 
  loadDashboardData('home');
});

