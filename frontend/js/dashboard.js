// frontend/js/dashboard.js

/**
 * Hàm để render danh sách thư mục ra giao diện
 * @param {Array} folders - Mảng các object thư mục lấy từ backend
 */
function renderFolders(folders) {
  const foldersContainer = document.querySelector('.grid-folders');
  foldersContainer.innerHTML = ''; // Xóa dữ liệu cũ (hoặc dữ liệu mẫu)

  if (!folders || folders.length === 0) {
    foldersContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Không có thư mục nào.</p>';
    return;
  }

  folders.forEach(folder => {
    // Tùy chọn màu sắc icon dựa vào loại thư mục hoặc ngẫu nhiên
    const colors = ['blue', 'purple', 'cyan', 'green'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const folderCard = document.createElement('div');
    folderCard.className = 'folder-card';
    // Lưu ID thư mục để xử lý sự kiện click sau này
    folderCard.dataset.id = folder.id;

    folderCard.innerHTML = `
      <i class="ph-fill ph-folder folder-icon ${folder.color || randomColor}"></i>
      <div class="file-info-main">
        <div class="folder-name" title="${folder.name}">${folder.name}</div>
        <div class="file-meta-mobile">${folder.updatedAt || 'Gần đây'}</div>
      </div>
      <div class="file-meta-col folder-meta-col file-date">${folder.updatedAt || 'Gần đây'}</div>
      <div class="file-meta-col folder-meta-col file-size">--</div>
      <div class="file-meta-col folder-meta-col file-shared">--</div>
    `;

    // Thêm sự kiện click vào thư mục
    folderCard.addEventListener('click', () => {
      console.log('Mở thư mục:', folder.id);
      // Gọi API lấy nội dung thư mục con tại đây...
    });

    foldersContainer.appendChild(folderCard);
  });
}

/**
 * Hàm để render danh sách tệp tin ra giao diện
 * @param {Array} files - Mảng các object tệp tin lấy từ backend
 */
function renderFiles(files) {
  const filesContainer = document.querySelector('.grid-files');
  filesContainer.innerHTML = ''; // Xóa dữ liệu mẫu

  if (!files || files.length === 0) {
    filesContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Không có tệp tin nào.</p>';
    return;
  }

  // Thêm header cho dạng List View
  const listHeader = document.createElement('div');
  listHeader.className = 'list-header';
  listHeader.innerHTML = `
    <div class="col-name">TÊN</div>
    <div class="col-date">NGÀY SỬA</div>
    <div class="col-size">KÍCH THƯỚC</div>
    <div class="col-shared">CHIA SẺ</div>
  `;
  filesContainer.appendChild(listHeader);

  files.forEach(file => {
    // Xác định icon và màu sắc dựa trên phần mở rộng của file
    let iconClass = 'ph-file';
    let colorClass = 'file-doc';
    const ext = file.name.split('.').pop().toLowerCase();

    if (['pdf'].includes(ext)) { iconClass = 'ph-file-pdf'; colorClass = 'file-pdf'; }
    else if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) { iconClass = 'ph-image'; colorClass = 'file-img'; }
    else if (['doc', 'docx', 'txt'].includes(ext)) { iconClass = 'ph-file-text'; colorClass = 'file-doc'; }
    else if (['xls', 'xlsx', 'csv'].includes(ext)) { iconClass = 'ph-file-xls'; colorClass = 'file-xls'; }
    else if (['mp4', 'avi', 'mov'].includes(ext)) { iconClass = 'ph-file-video'; colorClass = 'file-vid'; }
    else if (['zip', 'rar', 'tar', 'gz'].includes(ext)) { iconClass = 'ph-file-zip'; colorClass = 'file-zip'; }

    const fileCard = document.createElement('div');
    fileCard.className = 'file-card';
    fileCard.dataset.id = file.id;

    // Định dạng kích thước file
    const formatSize = (bytes) => {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    fileCard.innerHTML = `
      <div class="file-icon-box ${colorClass}">
        <i class="ph-fill ${iconClass}"></i>
      </div>
      <div class="file-info-main">
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-meta-mobile">${file.updatedAt || 'Gần đây'} &middot; ${formatSize(file.size)}</div>
      </div>
      <div class="file-meta-col file-date">${file.updatedAt || 'Gần đây'}</div>
      <div class="file-meta-col file-size">${formatSize(file.size)}</div>
      <div class="file-meta-col file-shared">
        <span class="shared-badge ${file.shared ? 'active' : ''}">${file.shared ? 'Đã chia sẻ' : 'Riêng tư'}</span>
      </div>
    `;

    // Sự kiện khi click vào file
    fileCard.addEventListener('click', () => {
      console.log('Xem chi tiết file:', file.id);
      // Xử lý mở preview file hoặc tải file...
    });

    filesContainer.appendChild(fileCard);
  });
}

/**
 * Hàm mẫu để gọi API lấy dữ liệu từ Backend
 * Gọi hàm này khi trang vừa load hoặc khi chuyển đổi giữa tab "Trang chủ" / "Tệp của tôi"
 */
async function loadDashboardData(viewType = 'home') {
  try {
    // Thay thế URL bằng endpoint thực tế của Backend
    // const response = await fetch(`/api/files?view=${viewType}`);
    // const data = await response.json();

    // Dữ liệu giả lập (Mock Data) để test giao diện
    const mockData = {
      folders: [
        { id: 1, name: 'Dự án A (Từ Backend)', updatedAt: 'Hôm nay', color: 'blue' },
        { id: 2, name: 'Tài liệu cá nhân', updatedAt: 'Hôm qua', color: 'green' }
      ],
      files: [
        { id: 101, name: 'BaoCao.pdf', size: 2500000, updatedAt: '10:30 AM' },
        { id: 102, name: 'Data.xlsx', size: 1048576, updatedAt: 'Hôm qua' }
      ]
    };

    // Render dữ liệu ra UI
    renderFolders(mockData.folders);
    renderFiles(mockData.files);

  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu từ backend:', error);
  }
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

/**
 * Xử lý giao diện Upload Modal
 */
function setupUploadModal() {
  const uploadModal = document.getElementById('uploadModal');
  const closeBtn = document.getElementById('closeUploadModal');
  const uploadBtns = document.querySelectorAll('.btn-upload-main, .btn-upload-outline');
  
  if (!uploadModal) return;

  // Đóng modal
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      uploadModal.style.display = 'none';
    });
  }

  // Mở modal khi bấm các nút Tải lên
  uploadBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      uploadModal.style.display = 'flex';
    });
  });

  // Thu gọn/mở rộng danh sách luồng tải
  const threadsHeader = document.querySelector('.threads-header');
  const threadList = document.querySelector('.thread-list');
  if (threadsHeader && threadList) {
    threadsHeader.style.cursor = 'pointer';
    threadsHeader.addEventListener('click', () => {
      const isHidden = threadList.style.display === 'none';
      threadList.style.display = isHidden ? 'flex' : 'none';
      const icon = threadsHeader.querySelector('i.ph-caret-up, i.ph-caret-down');
      if (icon) {
        icon.className = isHidden ? 'ph ph-caret-up' : 'ph ph-caret-down';
      }
    });
  }
}

// Khởi chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  setupTabNavigation();
  setupViewToggle();
  setupUploadModal();
  // Tạm thời gọi hàm với dữ liệu mẫu. 
  loadDashboardData('home');
});
