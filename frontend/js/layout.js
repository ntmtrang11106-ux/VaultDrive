const sidebarHTML = `
  <aside class="sidebar">
    <div class="logo-area">
      <div class="logo-icon">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.1325 20.176 10.2077 17.8596 10.0116C17.4326 6.64368 14.5683 4 11 4C7.13401 4 4 7.13401 4 11C4 11.2372 4.01174 11.4716 4.03454 11.7027C2.29063 12.1818 1 13.784 1 15.6667C1 17.8758 2.79086 19.6667 5 19.6667H17.5Z"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div class="logo-text">
        <span class="brand">VaultDrive</span>
        <span class="sub">LƯU TRỮ BẢO MẬT</span>
      </div>
    </div>

    <button class="btn-upload-main">
      <i class="ph ph-upload-simple"></i>
      Tải lên tệp
    </button>

    <ul class="nav-menu" id="main-nav-menu">
      <li class="nav-item active" data-view="home">
        <i class="ph-fill ph-house"></i>
        <span>Trang chủ</span>
      </li>
      <li class="nav-item" data-view="my-files">
        <i class="ph ph-folder"></i>
        <span>Tệp của tôi</span>
      </li>
      <li class="nav-item">
        <i class="ph ph-users"></i>
        <span>Được chia sẻ</span>
        <span class="badge">3</span>
      </li>
      <li class="nav-item">
        <i class="ph ph-clock"></i>
        <span>Gần đây</span>
      </li>
      <li class="nav-item">
        <i class="ph ph-trash"></i>
        <span>Thùng rác</span>
      </li>
    </ul>

    <div class="nav-section-title">HỆ THỐNG</div>
    <ul class="nav-menu">
      <li class="nav-item">
        <i class="ph ph-gear"></i>
        <span>Cài đặt</span>
      </li>
    </ul>

    <div class="sidebar-bottom">
      <div class="storage-info">
        <div class="storage-header">
          <span class="storage-label">Bộ nhớ</span>
          <span class="storage-value">38,4 / 100 GB</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="storage-remaining">61,6 GB còn lại</div>
      </div>

      <div class="user-profile">
        <div class="avatar">TM</div>
        <div class="user-details">
          <span class="user-name">Trần Minh</span>
          <span class="user-email">t.minh@congty.vn</span>
        </div>
        <i class="ph ph-caret-up" style="margin-left: auto; color: var(--text-muted);"></i>
      </div>
    </div>
  </aside>
`;

const headerHTML = `
  <header class="top-header">
    <div class="breadcrumbs" id="breadcrumb-container">
      <span class="current">Trang chủ</span>
    </div>

    <div class="header-actions">
      <div class="search-bar">
        <i class="ph ph-magnifying-glass"></i>
        <input type="text" placeholder="Tìm kiếm tệp...">
      </div>

      <div class="sort-dropdown">
        Ngày sửa <i class="ph ph-caret-down"></i>
      </div>

      <div class="view-toggle">
        <button class="view-btn active"><i class="ph ph-squares-four"></i></button>
        <button class="view-btn"><i class="ph ph-list"></i></button>
      </div>

      <button class="btn-upload-outline">
        <i class="ph ph-upload-simple"></i> Tải lên
      </button>

      <div class="notifications">
        <i class="ph ph-bell"></i>
        <div class="indicator">2</div>
      </div>
    </div>
  </header>
`;

// Inject components into the DOM when this script loads
const sidebarContainer = document.getElementById('sidebar-container');
const headerContainer = document.getElementById('header-container');

if (sidebarContainer) {
  sidebarContainer.outerHTML = sidebarHTML;
}

if (headerContainer) {
  headerContainer.outerHTML = headerHTML;
}
