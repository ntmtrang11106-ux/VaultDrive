// Mục đích: File JS CỐT LÕI của toàn bộ dashboard.
//   - Định nghĩa API_BASE_URL và fetchWithAuth (dùng chung cho MỌI file JS)
//   - Kiểm tra đăng nhập (Route Protection)
//   - Khởi tạo giao diện (initDashboardUI)
//   - Xử lý điều hướng tab, chuyển view Grid/List
//   - Lấy thông tin bộ nhớ, thông tin user từ backend/localStorage


// ================================================================
// CẤU HÌNH API
// ================================================================

// Đường dẫn gốc của Backend API.
// Mọi endpoint đều nối thêm vào: API_BASE_URL + "/files", "/folders", v.v.
const API_BASE_URL = "http://localhost:8080/api";


// ================================================================
// XÁC THỰC (AUTHENTICATION)
// ================================================================

/**
 * checkAuth() - Kiểm tra xem người dùng đã đăng nhập chưa
 * Cách hoạt động:
 *   - Đọc JWT token từ localStorage (được lưu lúc đăng nhập thành công)
 *   - Nếu KHÔNG có token → chuyển hướng ngay về trang đăng nhập
 *   - Nếu CÓ token → trả về token để dùng trong các API call
 */
function checkAuth() {
  const token = localStorage.getItem("jwt_token"); // Đọc token đã lưu
  if (!token) {
    // Nếu trong URL có token hoặc fileId để xem trước thì cho phép xem mà không bị chuyển hướng sang login
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("token") || urlParams.get("shareToken") || urlParams.get("fileId") || urlParams.get("previewFileId") || document.documentElement.classList.contains("preview-only-mode")) {
      return null;
    }
    // Token không tồn tại → user chưa đăng nhập hoặc đã đăng xuất
    window.location.href = "login.html"; // Chuyển về trang login
    return null;
  }
  return token; // Token hợp lệ → trả về để dùng tiếp
}

// Gọi ngay khi file được tải → bảo vệ trang dashboard
checkAuth();


// ================================================================
// HÀM GỌI API CÓ XÁC THỰC (fetchWithAuth)
// ================================================================

/**
 * fetchWithAuth(endpoint, options) - Wrapper của fetch() tự động thêm JWT token vào header
 * @param {string} endpoint - Đường dẫn API, VD: "/files", "/folders/1/trash"
 * @param {object} options  - Options của fetch() (method, body, headers...)
 * @returns {Response}       - Kết quả fetch() để caller tự xử lý .json() hay .blob()
 *
 * Lý do cần wrapper này: Mọi API đều cần header "Authorization: Bearer <token>".
 * Thay vì viết đi viết lại ở mỗi chỗ, ta viết 1 lần ở đây.
 */
async function fetchWithAuth(endpoint, options = {}) {
  const token = checkAuth(); // Lấy token (đồng thời check auth)
  if (!token) return;        // Nếu không có token → checkAuth đã redirect, dừng hàm

  // Tạo Headers object để thêm/đọc header một cách linh hoạt
  const headers = options.headers ? new Headers(options.headers) : new Headers();

  // Tránh đè Content-Type nếu đang gửi FormData (trình duyệt tự thêm boundary)
  // Nếu gửi JSON → tự thêm Content-Type: application/json
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Thêm JWT token vào header Authorization (Spring Security đọc header này)
  headers.set("Authorization", `Bearer ${token}`);

  // Ghép options gốc với headers mới (spread operator)
  const config = {
    ...options, // Giữ nguyên method, body, ... từ options gốc
    headers: headers // Ghi đè headers bằng headers đã bổ sung
  };

  // Thực hiện HTTP request đến Backend
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  // Xử lý lỗi xác thực: 401 Unauthorized hoặc 403 Forbidden
  if (response.status === 401 || response.status === 403) {
    // Token không hợp lệ hoặc hết hạn → tự động đăng xuất
    localStorage.removeItem("jwt_token");   // Xóa token cũ
    localStorage.removeItem("user_role");   // Xóa role cũ
    localStorage.removeItem("user_email");  // Xóa email cũ
    window.location.href = "login.html";    // Chuyển về trang đăng nhập
    throw new Error(`Lỗi xác thực (401/403) từ Backend. Đã chuyển hướng về trang đăng nhập.`);
  }

  return response; // Trả response cho caller xử lý tiếp
}


// ================================================================
// ĐIỀU HƯỚNG TAB (Tab Navigation)
// ================================================================

/**
 * setupTabNavigation() - Gắn sự kiện click cho các tab nav trong Sidebar
 * Khi click một tab:
 *   1. Bỏ active tab cũ, active tab mới + đổi icon fill/outline
 *   2. Reset folder path về root
 *   3. Cập nhật Breadcrumb
 *   4. Load dữ liệu phù hợp với tab (gọi loadDashboardData)
 */
function setupTabNavigation() {
  // Lấy tất cả các .nav-item trong menu (Tệp của tôi, Được chia sẻ, Thùng rác, Cài đặt)
  const navItems = document.querySelectorAll('#main-nav-menu .nav-item');
  const breadcrumbContainer = document.getElementById('breadcrumb-container');

  navItems.forEach(item => {
    item.addEventListener('click', async () => {

      // --- Bước 1: Reset trạng thái TẤT CẢ tab về không active ---
      navItems.forEach(nav => {
        nav.classList.remove('active'); // Bỏ màu xanh

        // Đổi icon từ ph-fill (đặc) → ph (nét mảnh) cho tab không active
        const icon = nav.querySelector('i');
        if (icon && icon.classList.contains('ph-fill')) {
          icon.classList.remove('ph-fill');
          icon.classList.add('ph');
        }
      });

      // --- Bước 2: Active tab vừa được click ---
      item.classList.add('active');

      // Đổi icon từ ph (nét mảnh) → ph-fill (đặc) cho tab active
      const icon = item.querySelector('i');
      if (icon && icon.classList.contains('ph')) {
        icon.classList.remove('ph');
        icon.classList.add('ph-fill');
      }

      // --- Bước 3: Lấy loại view từ data-view attribute ---
      // VD: <li data-view="home"> → viewType = 'home'
      const viewType = item.dataset.view; // 'home' | 'shared' | 'trash' | 'settings'

      // Reset navigation về root (hủy trạng thái đang ở thư mục con)
      window.currentFolderId = null; // Không còn đang ở trong thư mục nào

      // Xác định tiêu đề breadcrumb cho từng tab
      const rootTitle = viewType === 'shared' ? 'Được chia sẻ' :
        viewType === 'trash' ? 'Thùng rác' :
          viewType === 'settings' ? 'Cài đặt' :
            viewType === 'recent' ? 'Gần đây' : 'Tệp của tôi';

      // Reset lịch sử điều hướng thư mục về gốc
      window.folderPathTrail = [{ id: null, name: rootTitle }];

      // --- Bước 4: Cập nhật Breadcrumb UI ---
      if (typeof updateBreadcrumbUI === 'function') {
        updateBreadcrumbUI(); // Nếu hàm này đã được định nghĩa (trong file-actions.js)
      } else if (breadcrumbContainer) {
        // Fallback: gán trực tiếp nếu hàm updateBreadcrumbUI chưa sẵn sàng
        breadcrumbContainer.innerHTML = `<span class="current">${rootTitle}</span>`;
      }

      // --- Bước 5: Tải file HTML giao diện (Lazy loading) nếu cần ---
      if (viewType === 'trash') {
        const container = document.getElementById("trash-view-container");
        if (container && container.innerHTML.trim() === "") {
          try {
            const res = await fetch("views/trash-view.html");
            if (res.ok) {
              container.innerHTML = await res.text();
            }
          } catch (e) {
            console.error("Failed to load trash view:", e);
          }
        }
      } else if (viewType === 'settings') {
        const container = document.getElementById("settings-view-container");
        if (container && container.innerHTML.trim() === "") {
          try {
            const res = await fetch("views/settings-view.html");
            if (res.ok) {
              container.innerHTML = await res.text();
            }
          } catch (e) {
            console.error("Failed to load settings view:", e);
          }
        }
      }

      // --- Bước 6: Load dữ liệu cho tab tương ứng ---
      loadDashboardData(viewType); // Gọi hàm load data (định nghĩa trong file-actions.js)
    });
  });
}


// ================================================================
// CHUYỂN ĐỔI GIAO DIỆN GRID / LIST (View Toggle)
// ================================================================

/**
 * setupViewToggle() - Gắn sự kiện click cho 2 nút Grid View / List View
 * Grid View: Hiển thị file/folder dạng lưới ô vuông
 * List View:  Hiển thị file/folder dạng bảng với cột tên/ngày/kích thước/chia sẻ
 */
function setupViewToggle() {
  // Tìm nút Grid View (chứa icon ph-squares-four) và lấy phần tử cha (button)
  const gridBtn = document.querySelector('.view-btn i.ph-squares-four')?.parentElement;
  // Tìm nút List View
  const listBtn = document.querySelector('.view-btn i.ph-list')?.parentElement;
  const contentScroll = document.querySelector('.content-scroll');

  if (gridBtn) {
    gridBtn.addEventListener('click', () => {
      gridBtn.classList.add('active');    // Highlight nút Grid
      if (listBtn) listBtn.classList.remove('active'); // Bỏ highlight nút List

      // Xóa class .list-view → CSS sẽ hiển thị dạng lưới
      if (contentScroll) contentScroll.classList.remove('list-view');
      const gridFiles = document.querySelector('.grid-files');
      if (gridFiles) gridFiles.classList.remove('list-view');

      // Nếu đang ở tab "Được chia sẻ" → render lại theo format Grid
      if (window.currentViewType === 'shared' && typeof renderSharedView === 'function') {
        renderSharedView();
      }
    });
  }

  if (listBtn) {
    listBtn.addEventListener('click', () => {
      listBtn.classList.add('active');
      if (gridBtn) gridBtn.classList.remove('active');

      // Thêm class .list-view → CSS sẽ hiển thị dạng bảng
      if (contentScroll) contentScroll.classList.add('list-view');
      const gridFiles = document.querySelector('.grid-files');
      if (gridFiles) gridFiles.classList.add('list-view');

      // Nếu đang ở tab "Được chia sẻ" → render lại theo format List
      if (window.currentViewType === 'shared' && typeof renderSharedView === 'function') {
        renderSharedView();
      }
    });
  }
}


// ================================================================
// HÀM KHỞI TẠO DASHBOARD (entry point)
// ================================================================

/**
 * window.initDashboardUI - Hàm khởi tạo toàn bộ giao diện dashboard
 * Gán lên window để layout.js có thể gọi sau khi chèn Sidebar & Header vào DOM.
 *
 * Thứ tự khởi tạo:
 *   1. Gắn sự kiện tab nav & view toggle
 *   2. Setup Upload Modal & Drag&Drop
 *   3. Load dữ liệu trang chủ (home)
 *   4. Lấy thông tin bộ nhớ
 *   5. Lấy thông báo
 *   6. Lấy số lượng file được chia sẻ (hiện lên badge)
 *   7. Hiển thị thông tin user
 */
window.initDashboardUI = function () {
  const urlParams = new URLSearchParams(window.location.search);
  const isPreviewOnly = !!(urlParams.get("token") || urlParams.get("shareToken") || urlParams.get("fileId") || urlParams.get("previewFileId")) ||
    document.documentElement.classList.contains("preview-only-mode");
  if (isPreviewOnly) {
    return;
  }

  setupTabNavigation(); // 1a. Gắn sự kiện cho các tab
  setupViewToggle();    // 1b. Gắn sự kiện cho nút Grid/List

  // 2. Setup Upload Modal (nếu hàm setupUploadModal đã được định nghĩa bởi file-actions.js)
  if (typeof setupUploadModal === "function") setupUploadModal();

  // Setup Drag & Drop vào dropzone (nếu hàm đã sẵn sàng)
  if (typeof setupDragAndDrop === "function") setupDragAndDrop();

  // 3. Load dữ liệu view 'home' (Tệp của tôi) ngay khi vào trang
  if (typeof loadDashboardData === "function") loadDashboardData('home');

  // 4. (Đã chuyển logic storage sang layout.js)

  // 5. Lấy danh sách thông báo từ backend
  if (typeof fetchNotifications === "function") fetchNotifications();

  // 6. Lấy trước số lượng file chia sẻ để gán lên huy hiệu (badge) mà không cần click tab
  if (typeof fetchSharedCountBadge === "function") fetchSharedCountBadge();

};





// ================================================================
// KHỞI CHẠY KHI DOM SẴN SÀNG
// ================================================================

// DOMContentLoaded: Chạy sau khi HTML được parse xong (nhưng TRƯỚC khi ảnh, CSS tải xong)
document.addEventListener('DOMContentLoaded', () => {
  // Chỉ gọi initDashboardUI trực tiếp nếu KHÔNG có layout động
  // (Khi có layout.js, layout.js sẽ tự gọi initDashboardUI sau khi chèn layout xong)
  if (!document.getElementById('sidebar-container') && !document.getElementById('header-container')) {
    // Sidebar & Header đã có sẵn trong HTML (không cần tải động) → khởi tạo ngay
    window.initDashboardUI();
  }
  // Nếu CÓ sidebar-container → layout.js đang xử lý, không cần gọi ở đây
});


// ================================================================
// TIỆN ÍCH FORMAT DỮ LIỆU
// ================================================================

/**
 * formatSizeGlobal(bytes) - Chuyển đổi dung lượng từ bytes sang đơn vị đọc được
 * VD: 1536 → "1.5 KB", 5242880 → "5.0 MB"
 * @param {number} bytes - Dung lượng tính bằng byte
 * @returns {string}      - Chuỗi định dạng đọc được
 */
window.formatSizeGlobal = function (bytes) {
  if (!bytes) return "0 B"; // Trả về "0 B" nếu bytes là null/undefined/0

  const k = 1024;                               // 1 KB = 1024 B
  const sizes = ["B", "KB", "MB", "GB", "TB"]; // Mảng đơn vị

  // Tính bậc (i): log base 1024 của bytes → xác định đơn vị phù hợp
  // VD: 1536 bytes → log(1536)/log(1024) ≈ 1.05 → floor = 1 → "KB"
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Chia bytes cho 1024^i và làm tròn 1 chữ số thập phân
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}



