// frontend/js/layout.js
// Mục đích: Tải file layout.html (chứa HTML của Sidebar & Header) và chèn vào trang hiện tại.
//           Sau khi chèn xong, khởi tạo các sự kiện tương tác cho Sidebar & Header.
//
// Cách hoạt động:
//   1. Dùng fetch() để GET layout.html (file HTML thuần, không có <html>/<body>)
//   2. Parse HTML → tìm phần tử <aside> (Sidebar) và <header> (Header)
//   3. Thay thế các placeholder <div id="sidebar-container"> và <div id="header-container">
//   4. Gắn event listeners cho thông báo, dropdown upload, profile...
//   5. Gọi window.initDashboardUI() (được định nghĩa trong dashboard.js) để load dữ liệu


// ================================================================
// HÀM KHỞI TẠO SỰ KIỆN (chạy sau khi HTML layout đã được chèn vào trang)
// ================================================================
function initLayoutEvents() {

  // --- LẤY THAM CHIẾU ĐẾN CÁC PHẦN TỬ THÔNG BÁO ---
  const notifBtn = document.getElementById('notificationBtn');          // Nút chuông
  const notifDropdown = document.getElementById('notificationDropdown'); // Dropdown thông báo

  if (notifBtn && notifDropdown) {

    // Khi click vào chuông → toggle (hiện/ẩn) dropdown thông báo
    notifBtn.addEventListener('click', function (e) {
      notifDropdown.classList.toggle('show'); // CSS: .show { display: flex }
      e.stopPropagation(); // Ngăn event lan ra document (tránh đóng ngay lập tức)
    });

    // Click BÊN TRONG dropdown → KHÔNG đóng dropdown
    notifDropdown.addEventListener('click', function (e) {
      e.stopPropagation(); // Click bên trong bảng không làm đóng bảng
    });

    // Click BÊN NGOÀI dropdown → đóng dropdown
    document.addEventListener('click', function () {
      notifDropdown.classList.remove('show'); // Click ra ngoài sẽ đóng
    });

    // --- CHỨC NĂNG "ĐÁNH DẤU ĐÃ ĐỌC" ---
    const markReadBtn = notifDropdown.querySelector('.mark-read');
    if (markReadBtn) {
      // async: Hàm bất đồng bộ vì cần gọi API
      markReadBtn.addEventListener('click', async function (e) {
        e.preventDefault(); // Ngăn thẻ <a> nhảy lên đầu trang (#)

        try {
          // Lấy tất cả phần tử thông báo chưa đọc (class .unread)
          const unreadItems = notifDropdown.querySelectorAll('.notif-item.unread');

          // Tạo mảng các Promise API PATCH cho từng thông báo chưa đọc
          const promises = Array.from(unreadItems).map(item => {
            const id = item.dataset.id; // Lấy ID từ attribute data-id
            if (id) {
              // Gọi API PATCH /notifications/{id}/read để đánh dấu đã đọc
              return fetchWithAuth(`/notifications/${id}/read`, { method: "PATCH" });
            }
          });

          // Chờ TẤT CẢ API calls hoàn thành cùng lúc (song song)
          await Promise.all(promises);

          // Cập nhật UI sau khi API thành công:
          unreadItems.forEach(item => {
            item.classList.remove('unread'); // Xóa style "chưa đọc"
            const dot = item.querySelector('.unread-dot');
            if (dot) dot.remove();
          });
          const indicator = notifBtn.querySelector('.indicator');
          if (indicator) indicator.style.display = 'none'; // Ẩn badge số ở chuông
          const badge = notifDropdown.querySelector('.notif-badge');
          if (badge) badge.style.display = 'none';         // Ẩn badge số trong dropdown
        } catch (error) {
          console.error("Lỗi đánh dấu đã đọc", error);
        }
      });
    }
  }

  // --- CHỨC NĂNG ĐĂNG XUẤT ---
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Xóa token và chuyển hướng về trang đăng nhập
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("mock_user_profile");
      window.location.href = "login.html";
    });
  }

  // --- CHỨC NĂNG RESIZE SIDEBAR & CON TRỎ CHUỘT MÀU ĐEN ---
  const sidebar = document.querySelector('.sidebar');
  const resizer = document.getElementById('sidebarResizer');

  if (sidebar && resizer) {
    let isResizing = false;
    const minWidth = 290;

    // SVG icon con trỏ chuột màu đen (mũi tên 2 chiều ngang)
    const blackCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 256 256'><path fill='black' d='M205.66,122.34l-32-32a8,8,0,0,0-11.32,11.32L184.69,124H71.31l22.35-22.34a8,8,0,0,0-11.32-11.32l-32,32a8,8,0,0,0,0,11.32l32,32a8,8,0,0,0,11.32-11.32L71.31,132H184.69l-22.35,22.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,205.66,122.34Z'></path></svg>") 12 12, col-resize`;

    // Đặt con trỏ chuột màu đen khi hover vào thanh kéo
    resizer.style.cursor = blackCursor;

    resizer.addEventListener('mousedown', function (e) {
      e.preventDefault();
      isResizing = true;
      resizer.classList.add('active');
      document.body.style.cursor = blackCursor; // Giữ con trỏ đen khi kéo ra ngoài
    });

    document.addEventListener('mousemove', function (e) {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < minWidth) newWidth = minWidth;
      sidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = ''; // Trả lại con trỏ bình thường
      }
    });
  }

  // --- VẼ THANH TIẾN TRÌNH BỘ NHỚ TRONG LAYOUT.JS ---
  window.renderStorageInfo = async function() {
    const storageValue = document.querySelector('.storage-value');
    const progressFill = document.querySelector('.progress-fill');
    const storageRemaining = document.querySelector('.storage-remaining');

    if (!storageValue || !progressFill || !storageRemaining) return;

    let data = null;
    try {
      // Gọi API thực tế (nếu hàm fetchWithAuth có sẵn từ dashboard.js)
      if (typeof window.fetchWithAuth === "function") {
        const response = await window.fetchWithAuth("/dashboard/storage");
        if (response && response.ok) {
          data = await response.json();
        }
      }
    } catch (error) {
      console.warn("API lỗi, dùng dữ liệu ảo cho Storage.");
    }

    // Nếu không có data, dùng dữ liệu ảo (Mock Data)
    const usedBytes = data ? data.usedBytes : (38.4 * 1024 * 1024 * 1024);
    const maxBytes = data ? data.maxBytes : (100 * 1024 * 1024 * 1024);

    // Dùng hàm formatSizeGlobal nếu có, không thì tự format đơn giản
    let usedStr, maxStr, remainingStr;
    const format = (bytes) => {
      if (typeof window.formatSizeGlobal === "function") return window.formatSizeGlobal(bytes);
      return (bytes / (1024 * 1024 * 1024)).toFixed(1).replace('.', ',') + " GB";
    };

    usedStr = format(usedBytes);
    maxStr = format(maxBytes);
    const remainingBytes = Math.max(0, maxBytes - usedBytes);
    remainingStr = format(remainingBytes);

    let percent = 0;
    if (maxBytes > 0) {
      percent = (usedBytes / maxBytes) * 100;
      // Đảm bảo không vượt quá 100%
      percent = Math.min(100, percent);
      // Nếu có dùng dung lượng mà tỷ lệ quá bé (< 1%), ép lên 1% để thấy tia hy vọng màu xanh
      if (percent < 1 && usedBytes > 0) percent = 1;
    }

    storageValue.textContent = `${usedStr} / ${maxStr}`;
    progressFill.style.width = `${percent}%`;
    storageRemaining.textContent = `${remainingStr} còn lại`;
  }

  // Thực thi hàm vẽ storage ngay khi layout load xong
  if (typeof window.renderStorageInfo === "function") window.renderStorageInfo();

  // Đọc thông tin user từ localStorage và cập nhật lên Sidebar
  function renderUserInfo() {
    const userNameEl = document.getElementById("userName");
    const userEmailEl = document.getElementById("userEmail");
    const userAvatarEl = document.getElementById("userAvatar");

    if (!userNameEl || !userEmailEl || !userAvatarEl) return;

    const savedProfileStr = localStorage.getItem("mock_user_profile");
    const fallbackEmail = localStorage.getItem("user_email") || "nguoidung@congty.vn";
    let fullName = "Người dùng";
    let email = fallbackEmail;

    if (savedProfileStr) {
      try {
        const profile = JSON.parse(savedProfileStr);
        fullName = profile.fullName || fullName;
        email = profile.email || email;
      } catch (e) { }
    } else {
      fullName = email.split('@')[0];
    }

    userNameEl.textContent = fullName;
    userEmailEl.textContent = email;
    userAvatarEl.textContent = fullName.substring(0, 2).toUpperCase();
  }
  
  renderUserInfo();

  // Nếu dashboard.js đã load xong và có hàm initDashboardUI, gọi luôn
  // (Trường hợp layout.js chạy xong TRƯỚC khi dashboard.js xong thì không cần)
  if (typeof window.initDashboardUI === 'function') {
    window.initDashboardUI();
  }
}


// ================================================================
// TẢI VÀ CHÈN LAYOUT HTML VÀO TRANG (Bỏ qua nếu đang mở xem trước riêng biệt)
// ================================================================
const layoutUrlParams = new URLSearchParams(window.location.search);
const isPreviewLayoutMode = !!(layoutUrlParams.get("token") || layoutUrlParams.get("shareToken") || layoutUrlParams.get("fileId") || layoutUrlParams.get("previewFileId")) ||
  document.documentElement.classList.contains("preview-only-mode");

if (!isPreviewLayoutMode) {
  fetch('layout.html') // GET file layout.html từ cùng thư mục
    .then(response => {
      // Kiểm tra HTTP status (200 OK, 404 Not Found, ...)
      if (!response.ok) throw new Error('Không thể tải file layout.html');
      return response.text(); // Chuyển response body thành chuỗi HTML
    })
    .then(html => {
    // 1. Tạo một container ảo (không hiển thị) để parse HTML tải về
    //    Dùng div ảo thay vì DOMParser để dễ dàng querySelector
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html; // Trình duyệt parse HTML string → DOM nodes

    // 2. Tìm các phần tử cần thiết bên trong file layout.html đã parse
    const sidebarElement = tempDiv.querySelector('.sidebar');     // <aside class="sidebar">
    const headerElement = tempDiv.querySelector('.top-header');  // <header class="top-header">

    // 3. Tìm các placeholder đang chờ trên trang (dashboard.html)
    const sidebarContainer = document.getElementById('sidebar-container'); // <div id="sidebar-container">
    const headerContainer = document.getElementById('header-container');   // <div id="header-container">

    // 4. Lắp ráp: Thay thế placeholder bằng phần tử thật từ layout.html
    //    replaceWith() → thay toàn bộ node placeholder bằng sidebar/header thật
    if (sidebarContainer && sidebarElement) {
      sidebarContainer.replaceWith(sidebarElement);
    }

    if (headerContainer && headerElement) {
      headerContainer.replaceWith(headerElement);
    }

    // 5. Sau khi DOM đã có Sidebar & Header thật, khởi tạo các sự kiện tương tác
    initLayoutEvents();
  })
  .catch(err => {
    console.error("Lỗi tải layout:", err);
  });
}


// ================================================================
// HÀM LẤY THÔNG BÁO TỪ BACKEND VÀ RENDER VÀO DROPDOWN
// Được gọi từ initDashboardUI() trong dashboard.js
// Gán lên window để các file khác có thể gọi: window.fetchNotifications()
// ================================================================
window.fetchNotifications = async function () {
  // Lấy tham chiếu đến các phần tử UI cần cập nhật
  const notifList = document.querySelector('.notif-list');         // Container danh sách
  const indicator = document.querySelector('#notificationBtn .indicator'); // Badge số ở chuông
  const badge = document.querySelector('.notif-badge');            // Badge số trong header dropdown

  if (!notifList) return; // Sidebar chưa được chèn vào → bỏ qua

  // Cố gắng gọi API
  let notifications = [];
  try {
    const res = await fetchWithAuth("/notifications");
    if (res && res.ok) {
      notifications = await res.json();
    } else {
      throw new Error("API lỗi");
    }
  } catch (error) {
    console.error("Lỗi lấy thông báo từ Backend:", error);
    notifications = []; // Xóa dữ liệu mẫu, chỉ sử dụng dữ liệu thật
  }

  let unreadCount = 0; // Đếm số thông báo chưa đọc

  // Xóa nội dung cũ trong danh sách (chỉ xóa các item cũ, giữ nguyên template và footer)
  const oldItems = notifList.querySelectorAll('.notif-item:not(template .notif-item)');
  oldItems.forEach(item => item.remove());

  // Xóa thông báo trống nếu có
  const emptyMsg = notifList.querySelector('.empty-notif');
  if (emptyMsg) emptyMsg.remove();

  if (!notifications || notifications.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-notif';
    emptyDiv.textContent = 'Không có thông báo nào';
    // Chèn sau template
    const templateNode = document.getElementById('notif-item-template');
    if (templateNode) {
      templateNode.insertAdjacentElement('afterend', emptyDiv);
    } else {
      notifList.prepend(emptyDiv);
    }

    if (indicator) indicator.style.display = 'none';
    if (badge) badge.style.display = 'none';
    return;
  }

  const template = document.getElementById('notif-item-template');
  if (!template) {
    console.error("Không tìm thấy template thông báo!");
    return;
  }

  // Duyệt qua từng thông báo để tạo DOM từ template
  notifications.forEach((notif, index) => {
    // Backend Spring Boot thường trả về isRead, mock cũ trả về read
    const isUnread = !(notif.isRead === true || notif.read === true);

    if (isUnread) unreadCount++; // Đếm thông báo chưa đọc

    // Clone template ra thành 1 phần tử DOM thật
    const clone = template.content.cloneNode(true);
    const itemNode = clone.querySelector('.notif-item');

    itemNode.dataset.id = notif.id;

    // Class CSS cho item: thêm 'unread' nếu chưa đọc
    if (isUnread) {
      itemNode.classList.add('unread');
      // Thêm chấm xanh báo chưa đọc
      const dot = document.createElement('div');
      dot.className = 'unread-dot';
      itemNode.appendChild(dot);
    }

    // Chọn icon phù hợp theo loại thông báo
    const iconClass = notif.type === 'USER' ? 'ph-user' : (notif.type === 'SUCCESS' || notif.type === 'UPLOAD_COMPLETE' ? 'ph-check-square' : 'ph-warning');
    // Chọn màu nền icon theo loại thông báo
    const bgClass = notif.type === 'USER' ? 'bg-purple' : (notif.type === 'SUCCESS' || notif.type === 'UPLOAD_COMPLETE' ? 'bg-green' : 'bg-yellow');

    const iconContainer = itemNode.querySelector('.notif-icon');
    if (iconContainer) {
      iconContainer.classList.add(bgClass);
      const iTag = iconContainer.querySelector('i');
      if (iTag) iTag.className = `ph-fill ${iconClass}`;
    }

    // Điền text
    itemNode.querySelector('.notif-title').textContent = notif.title || 'Thông báo';
    itemNode.querySelector('.notif-desc').textContent = notif.content || notif.message || '';
    const formatTimeFn = window.formatSmartDate || (typeof formatSmartDate === 'function' ? formatSmartDate : null);
    itemNode.querySelector('.notif-time').textContent = formatTimeFn ? formatTimeFn(notif.createdAt) : (notif.createdAt || 'Vừa xong');

    // Xử lý sự kiện click từng thông báo để đánh dấu đã đọc
    itemNode.addEventListener('click', async (e) => {
      // Nếu là thông báo chưa đọc
      if (itemNode.classList.contains('unread')) {
        try {
          const res = await fetchWithAuth(`/notifications/${notif.id}/read`, { method: "PATCH" });
          if (res && res.ok) {
            // Cập nhật UI cho thông báo này
            itemNode.classList.remove('unread');
            const dot = itemNode.querySelector('.unread-dot');
            if (dot) dot.remove();

            // Cập nhật số lượng trên chuông
            const indicatorEl = document.querySelector('#notificationBtn .indicator');
            const badgeEl = document.querySelector('.notif-badge');

            let currentCount = parseInt(indicatorEl?.textContent || '0', 10);
            if (currentCount > 0) {
              currentCount--;
              if (currentCount === 0) {
                if (indicatorEl) indicatorEl.style.display = 'none';
                if (badgeEl) badgeEl.style.display = 'none';
              } else {
                if (indicatorEl) indicatorEl.textContent = currentCount;
                if (badgeEl) badgeEl.textContent = currentCount;
              }
            }
          }
        } catch (err) {
          console.error("Lỗi khi đánh dấu đã đọc 1 thông báo:", err);
        }
      }
    });

    // Ẩn các thông báo từ vị trí thứ 6 trở đi
    if (index >= 5) {
      itemNode.style.display = 'none';
      itemNode.classList.add('extra-notif');
    }

    // Nhét phần tử vừa tạo vào danh sách (phải chèn TRƯỚC footer)
    const footer = notifList.querySelector('.notif-footer');
    if (footer) {
      notifList.insertBefore(clone, footer);
    } else {
      notifList.appendChild(clone);
    }
  });

  // Xử lý nút Xem tất cả
  const viewAllBtn = document.getElementById('viewAllNotifBtn');
  if (viewAllBtn) {
    if (notifications.length > 5) {
      viewAllBtn.parentElement.style.display = 'block';
      viewAllBtn.onclick = async (e) => {
        e.preventDefault();
        // Hiện tất cả các thông báo bị ẩn
        notifList.querySelectorAll('.extra-notif').forEach(el => el.style.display = 'flex');
        // Ẩn nút xem tất cả sau khi đã mở rộng
        viewAllBtn.parentElement.style.display = 'none';

        // Tự động đánh dấu đã đọc và gọi API cho các mục chưa đọc
        const unreadItems = notifList.querySelectorAll('.notif-item.unread');
        if (unreadItems.length > 0) {
          try {
            const promises = Array.from(unreadItems).map(item => {
              const id = item.dataset.id;
              if (id) return fetchWithAuth(`/notifications/${id}/read`, { method: "PATCH" });
            });
            await Promise.all(promises);

            unreadItems.forEach(item => {
              item.classList.remove('unread');
              const dot = item.querySelector('.unread-dot');
              if (dot) dot.remove();
            });

            if (indicator) indicator.style.display = 'none';
            if (badge) badge.style.display = 'none';
          } catch (err) {
            console.error("Lỗi khi đánh dấu đã đọc:", err);
          }
        }
      };
    } else {
      // Nếu ít hơn hoặc bằng 5 thông báo thì ẩn luôn nút Xem tất cả
      viewAllBtn.parentElement.style.display = 'none';
    }
  }

  // Cập nhật badge số lượng chưa đọc
  if (unreadCount > 0) {
    if (indicator) {
      indicator.textContent = unreadCount; // Gán số vào badge chuông
      indicator.style.display = 'flex';
    }
    if (badge) {
      badge.textContent = unreadCount; // Gán số vào badge header
      badge.style.display = 'inline-block';
    }
  } else {
    // Không có thông báo chưa đọc → ẩn cả 2 badge
    if (indicator) indicator.style.display = 'none';
    if (badge) badge.style.display = 'none';
  }
};


// ================================================================
// BADGE SỐ LƯỢNG FILE ĐƯỢC CHIA SẺ
// ================================================================

/**
 * Lấy số lượng file/folder người khác chia sẻ cho mình
 * và hiển thị lên badge của tab "Được chia sẻ" trong Sidebar
 */
window.fetchSharedCountBadge = async function() {
  try {
    const response = await fetchWithAuth("/shares/shared-with-me");
    if (response && response.ok) {
      const sharedList = await response.json();

      let items = [];
      if (Array.isArray(sharedList)) {
        items = sharedList; 
      } else if (sharedList && typeof sharedList === "object") {
        const f1 = sharedList.folders || sharedList.subfolders || [];
        const f2 = sharedList.files || [];
        items = [...f1, ...f2]; 
      }

      const totalItems = items.length; 

      // Tìm badge trong Sidebar
      const sidebarBadge = document.querySelector('.nav-item[data-view="shared"] .badge');
      if (sidebarBadge) {
        // Luôn hiển thị số
        sidebarBadge.textContent = totalItems;
      }
    }
  } catch (error) {
    console.warn("Không thể lấy số lượng tệp chia sẻ", error);
  }
};
