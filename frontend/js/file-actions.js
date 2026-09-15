// frontend/js/file-actions.js

// Biến lưu trữ ID của file/folder đang được click chuột phải / 3 chấm
let currentTargetId = null;
let currentTargetType = null; // 'file' or 'folder'

document.addEventListener("DOMContentLoaded", () => {
  const contextMenu = document.getElementById("globalContextMenu");

  // DOM elements của Modals
  const renameOverlay = document.getElementById("renameModalOverlay");
  const shareOverlay = document.getElementById("shareModalOverlay");

  // 1. Logic ẩn Menu
  document.addEventListener("click", (e) => {
    // Nếu click ra ngoài menu thì ẩn
    if (
      !e.target.closest(".custom-context-menu") &&
      !e.target.closest(".more-options")
    ) {
      contextMenu.style.display = "none";
      document
        .querySelectorAll(".more-options.active")
        .forEach((el) => el.classList.remove("active"));
    }
  });

  // Export hàm để dashboard.js có thể gọi khi click nút 3 chấm
  window.openContextMenu = function (e, id, type) {
    e.stopPropagation(); // Ngăn sự kiện nổi bọt
    currentTargetId = id;
    currentTargetType = type;

    // Reset các nút 3 chấm khác
    document
      .querySelectorAll(".more-options.active")
      .forEach((el) => el.classList.remove("active"));

    // Nổi bật nút hiện tại
    const btn = e.currentTarget;
    btn.classList.add("active");

    // Mở menu
    contextMenu.style.display = "block";

    // Tính toán tọa độ hiển thị (tránh bị tràn màn hình)
    const btnRect = btn.getBoundingClientRect();
    let left = btnRect.right + 10;
    let top = btnRect.top;

    // Nếu tràn lề phải, đẩy sang trái
    if (left + contextMenu.offsetWidth > window.innerWidth) {
      left = btnRect.left - contextMenu.offsetWidth - 10;
    }
    // Nếu tràn lề dưới, đẩy lên trên
    if (top + contextMenu.offsetHeight > window.innerHeight) {
      top = window.innerHeight - contextMenu.offsetHeight - 10;
    }

    contextMenu.style.left = left + "px";
    contextMenu.style.top = top + "px";
  };

  // Xử lý chống tràn màn hình cho các submenu
  const hasSubmenuItems = document.querySelectorAll(
    ".context-menu-item.has-submenu",
  );
  hasSubmenuItems.forEach((item) => {
    item.addEventListener("mouseenter", function () {
      const submenu = this.querySelector(".context-submenu");
      if (submenu) {
        // Trạng thái mặc định (mở sang phải)
        submenu.style.left = "100%";
        submenu.style.right = "auto";

        const rect = submenu.getBoundingClientRect();
        // Nếu cạnh phải của submenu vượt ra khỏi màn hình
        if (rect.right > window.innerWidth) {
          // Lật sang mở bên trái
          submenu.style.left = "auto";
          submenu.style.right = "100%";
        }
      }
    });
  });

  // 2. Logic click các mục trong Context Menu
  document.getElementById("ctxRename").addEventListener("click", () => {
    contextMenu.style.display = "none";
    
    let currentName = "";
    if (window.mockData) {
      if (currentTargetType === 'file') {
        const file = window.mockData.files.find(f => f.id === currentTargetId);
        if (file) currentName = file.name;
      } else if (currentTargetType === 'folder') {
        const folder = window.mockData.folders.find(f => f.id === currentTargetId);
        if (folder) currentName = folder.name;
      }
    }
    
    document.getElementById("renameInput").value = currentName || "";
    renameOverlay.style.display = "flex";
    document.getElementById("renameInput").focus();
  });

  // Hàm giả lập lấy danh sách người dùng được chia sẻ từ backend
  async function fetchSharedUsers(itemId, itemType) {
    const container = document.getElementById("sharedUsersListContainer");
    if (!container) return;
    
    // Hiển thị trạng thái đang tải
    container.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 13px; padding: 20px;">Đang tải danh sách...</div>';
    
    try {
      // TODO: Thay bằng API fetch thực tế
      // const res = await fetch(`/api/shares/${itemType}/${itemId}`);
      // const data = await res.json();
      
      // Giả lập độ trễ mạng
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Dữ liệu giả lập
      const mockSharedUsers = [
        {
          id: 'u1',
          name: 'Tôi (Chủ sở hữu)',
          email: 'minh@congty.vn',
          role: 'OWNER',
          avatar: 'M',
          color: 'avatar-purple'
        },
        {
          id: 'u2',
          name: 'Hải Anh',
          email: 'haianh@congty.vn',
          role: 'EDITOR',
          avatar: 'A',
          color: ''
        }
      ];
      
      // Render
      container.innerHTML = mockSharedUsers.map(user => {
        if (user.role === 'OWNER') {
          return `
            <div class="shared-user-item">
              <div class="shared-user-info">
                <div class="shared-user-avatar ${user.color}">${user.avatar}</div>
                <div class="shared-user-details">
                  <span class="su-name">${user.name}</span>
                  <span class="su-email">${user.email}</span>
                </div>
              </div>
              <span class="su-role-text">Chủ sở hữu</span>
            </div>
          `;
        } else {
          const bgColor = user.color ? '' : 'style="background-color: #0ea5e9;"'; // Màu mặc định
          return `
            <div class="shared-user-item">
              <div class="shared-user-info">
                <div class="shared-user-avatar ${user.color}" ${bgColor}>${user.avatar}</div>
                <div class="shared-user-details">
                  <span class="su-name">${user.name}</span>
                  <span class="su-email">${user.email}</span>
                </div>
              </div>
              <select class="share-role-select-inline" onchange="window.updateShareRole('${user.id}', this.value, '${itemId}')">
                <option value="VIEWER" ${user.role === 'VIEWER' ? 'selected' : ''}>Người xem</option>
                <option value="EDITOR" ${user.role === 'EDITOR' ? 'selected' : ''}>Người chỉnh sửa</option>
                <option value="REMOVE" class="text-danger">Xóa quyền</option>
              </select>
            </div>
          `;
        }
      }).join('');
      
    } catch (err) {
      container.innerHTML = '<div style="color: red; text-align: center; font-size: 13px; padding: 20px;">Lỗi tải dữ liệu người dùng.</div>';
    }
  }

  // Khai báo hàm updateShareRole ở dạng global để có thể gọi từ onchange trong HTML
  window.updateShareRole = async function(userId, newRole, fileId) {
    if (newRole === 'REMOVE') {
       // TODO: Gọi API xóa quyền
       console.log(`Xóa quyền truy cập của user ${userId} khỏi tệp ${fileId}`);
    } else {
       // TODO: Gọi API cập nhật quyền
       console.log(`Cập nhật quyền user ${userId} thành ${newRole} cho tệp ${fileId}`);
    }
  };

  document.getElementById("ctxShare").addEventListener("click", async () => {
    contextMenu.style.display = "none";
    shareOverlay.style.display = "flex";
    
    // Lấy thông tin từ backend
    await fetchSharedUsers(currentTargetId, currentTargetType);
  });

  document.getElementById("ctxDownload").addEventListener("click", () => {
    contextMenu.style.display = "none";
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.click();
  });

  document.getElementById("ctxDelete").addEventListener("click", () => {
    contextMenu.style.display = "none";
    
    if (window.mockData) {
      if (currentTargetType === 'file') {
        const index = window.mockData.files.findIndex(f => f.id === currentTargetId);
        if (index !== -1) {
          window.mockData.files.splice(index, 1);
          if (typeof renderFiles === "function") renderFiles(window.mockData.files);
        }
      } else if (currentTargetType === 'folder') {
        const index = window.mockData.folders.findIndex(f => f.id === currentTargetId);
        if (index !== -1) {
          window.mockData.folders.splice(index, 1);
          if (typeof renderFolders === "function") renderFolders(window.mockData.folders);
        }
      }
    }
  });

  document.getElementById("ctxCopyLink").addEventListener("click", () => {
    contextMenu.style.display = "none";
    const link = `https://vaultdrive.com/share/${currentTargetId}`;
    navigator.clipboard.writeText(link)
      .then(() => alert(`Đã sao chép liên kết:\n${link}`))
      .catch(() => alert("Trình duyệt không hỗ trợ sao chép tự động!"));
  });

  // 3. Logic đóng mở Rename Modal
  document
    .getElementById("closeRenameModal")
    .addEventListener("click", () => (renameOverlay.style.display = "none"));
  document
    .getElementById("cancelRenameBtn")
    .addEventListener("click", () => (renameOverlay.style.display = "none"));
  document.getElementById("confirmRenameBtn").addEventListener("click", () => {
    const newName = document.getElementById("renameInput").value.trim();
    if (!newName) return; // Không làm gì nếu để trống
    
    if (window.mockData) {
      if (currentTargetType === 'file') {
        const file = window.mockData.files.find(f => f.id === currentTargetId);
        if (file) file.name = newName;
      } else if (currentTargetType === 'folder') {
        const folder = window.mockData.folders.find(f => f.id === currentTargetId);
        if (folder) folder.name = newName;
      }
      
      // Render lại giao diện
      if (typeof renderFolders === "function") renderFolders(window.mockData.folders);
      if (typeof renderFiles === "function") renderFiles(window.mockData.files);
    }
    
    renameOverlay.style.display = "none";
  });

  // 4. Logic đóng mở Share Modal
  document
    .getElementById("closeShareModal")
    .addEventListener("click", () => (shareOverlay.style.display = "none"));
  document
    .getElementById("doneShareBtn")
    .addEventListener("click", () => (shareOverlay.style.display = "none"));
  document.getElementById("copyLinkBtnModal").addEventListener("click", () => {
    const link = `https://vaultdrive.com/share/${currentTargetId}`;
    navigator.clipboard.writeText(link)
      .then(() => alert(`Đã sao chép liên kết:\n${link}`))
      .catch(() => alert("Trình duyệt không hỗ trợ sao chép tự động!"));
  });

  document.getElementById("addShareUserBtn").addEventListener("click", () => {
    const emailInput = document.getElementById("shareEmailInput");
    const roleSelect = document.getElementById("shareRoleSelect");
    const container = document.getElementById("sharedUsersListContainer");
    
    const email = emailInput.value.trim();
    const role = roleSelect.value;
    
    if (!email) {
      alert("Vui lòng nhập email hợp lệ!");
      return;
    }
    
    // TODO: Gửi request lên backend ở đây
    // fetch('/api/share', { method: 'POST', ... })
    
    const userId = 'u' + Date.now();
    const name = email.split('@')[0];
    const avatar = name.charAt(0).toUpperCase();
    
    const newUserHtml = `
      <div class="shared-user-item">
        <div class="shared-user-info">
          <div class="shared-user-avatar" style="background-color: #f59e0b;">${avatar}</div>
          <div class="shared-user-details">
            <span class="su-name">${name}</span>
            <span class="su-email">${email}</span>
          </div>
        </div>
        <select class="share-role-select-inline" onchange="window.updateShareRole('${userId}', this.value, '${currentTargetId}')">
          <option value="VIEWER" ${role === 'VIEWER' ? 'selected' : ''}>Người xem</option>
          <option value="EDITOR" ${role === 'EDITOR' ? 'selected' : ''}>Người chỉnh sửa</option>
          <option value="REMOVE" class="text-danger">Xóa quyền</option>
        </select>
      </div>
    `;
    
    if (container) {
      container.insertAdjacentHTML('beforeend', newUserHtml);
    }
    
    emailInput.value = ""; // Xóa input
  });
});

// ==========================================
// RENDER & UPLOAD FILE/FOLDER (Moved from dashboard.js)
// ==========================================

/**
 * Hàm để render danh sách thư mục ra giao diện
 * @param {Array} folders - Mảng các object thư mục lấy từ backend
 */
function renderFolders(folders) {
  const foldersContainer = document.querySelector(".grid-folders");
  foldersContainer.innerHTML = ""; // Xóa dữ liệu cũ (hoặc dữ liệu mẫu)

  if (!folders || folders.length === 0) {
    foldersContainer.innerHTML =
      '<p style="color: var(--text-muted); font-size: 14px;">Không có thư mục nào.</p>';
    return;
  }

  folders.forEach((folder) => {
    // Tùy chọn màu sắc icon dựa vào loại thư mục hoặc ngẫu nhiên
    const colors = ["blue", "purple", "cyan", "green"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const folderCard = document.createElement("div");
    folderCard.className = "folder-card";
    // Lưu ID thư mục để xử lý sự kiện click sau này
    folderCard.dataset.id = folder.id;

    folderCard.innerHTML = `
      <div class="more-options" onclick="window.openContextMenu(event, ${folder.id}, 'folder')">
        <i class="ph-bold ph-dots-three-vertical"></i>
      </div>
      <i class="ph-fill ph-folder folder-icon ${folder.color || randomColor}"></i>
      <div class="file-info-main">
        <div class="folder-name" title="${folder.name}">${folder.name}</div>
        <div class="file-meta-mobile">${folder.updatedAt || "Gần đây"}</div>
      </div>
      <div class="file-meta-col folder-meta-col file-date">${folder.updatedAt || "Gần đây"}</div>
      <div class="file-meta-col folder-meta-col file-size">--</div>
      <div class="file-meta-col folder-meta-col file-shared">--</div>
    `;

    // Thêm sự kiện click vào thư mục
    folderCard.addEventListener("click", () => {
      console.log("Mở thư mục:", folder.id);
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
  const filesContainer = document.querySelector(".grid-files");
  filesContainer.innerHTML = ""; // Xóa dữ liệu mẫu

  if (!files || files.length === 0) {
    filesContainer.innerHTML =
      '<p style="color: var(--text-muted); font-size: 14px;">Không có tệp tin nào.</p>';
    return;
  }

  // Thêm header cho dạng List View
  const listHeader = document.createElement("div");
  listHeader.className = "list-header";
  listHeader.innerHTML = `
    <div class="col-name">TÊN</div>
    <div class="col-date">NGÀY SỬA</div>
    <div class="col-size">KÍCH THƯỚC</div>
    <div class="col-shared">CHIA SẺ</div>
  `;
  filesContainer.appendChild(listHeader);

  files.forEach((file) => {
    // Xác định icon và màu sắc dựa trên phần mở rộng của file
    let iconClass = "ph-file";
    let colorClass = "file-doc";
    const ext = file.name.split(".").pop().toLowerCase();

    if (["pdf"].includes(ext)) {
      iconClass = "ph-file-pdf";
      colorClass = "file-pdf";
    } else if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) {
      iconClass = "ph-image";
      colorClass = "file-img";
    } else if (["doc", "docx", "txt"].includes(ext)) {
      iconClass = "ph-file-text";
      colorClass = "file-doc";
    } else if (["xls", "xlsx", "csv"].includes(ext)) {
      iconClass = "ph-file-xls";
      colorClass = "file-xls";
    } else if (["mp4", "avi", "mov"].includes(ext)) {
      iconClass = "ph-file-video";
      colorClass = "file-vid";
    } else if (["zip", "rar", "tar", "gz"].includes(ext)) {
      iconClass = "ph-file-zip";
      colorClass = "file-zip";
    }

    const fileCard = document.createElement("div");
    fileCard.className = "file-card";
    fileCard.dataset.id = file.id;

    // Định dạng kích thước file
    const formatSize = (bytes) => {
      if (!bytes) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    fileCard.innerHTML = `
      <div class="more-options" onclick="window.openContextMenu(event, ${file.id}, 'file')">
        <i class="ph-bold ph-dots-three-vertical"></i>
      </div>
      <div class="file-icon-box ${colorClass}">
        <i class="ph-fill ${iconClass}"></i>
      </div>
      <div class="file-info-main">
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-meta-mobile">${file.updatedAt || "Gần đây"} &middot; ${formatSize(file.size)}</div>
      </div>
      <div class="file-meta-col file-date">${file.updatedAt || "Gần đây"}</div>
      <div class="file-meta-col file-size">${formatSize(file.size)}</div>
      <div class="file-meta-col file-shared">
        <span class="shared-badge ${file.shared ? "active" : ""}">${file.shared ? "Đã chia sẻ" : "Riêng tư"}</span>
      </div>
    `;

    // Sự kiện khi click vào file
    fileCard.addEventListener("click", (e) => {
      // Bỏ qua nếu bấm vào nút more-options
      if (e.target.closest('.more-options')) return;

      console.log("Xem chi tiết file:", file.id);
      // Bạn có thể xử lý việc mở file (nếu có tính năng khác sau này) tại đây.
    });

    filesContainer.appendChild(fileCard);
  });
}

function setupDragAndDrop() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.getElementById("browseFileBtn");

  if (!dropzone || !fileInput || !browseBtn) return;

  // Bấm vào nút "duyệt" hoặc bấm thẳng vào khung dropzone đều mở File Explorer
  browseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.click();
  });

  dropzone.addEventListener("click", (e) => {
    if (e.target !== browseBtn) {
      fileInput.click();
    }
  });

  // Khi chọn file từ File Explorer
  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  // Xử lý các sự kiện Drag & Drop
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Thêm class đổi màu khi kéo file vào khung
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(
      eventName,
      () => {
        dropzone.classList.add("dragover");
      },
      false,
    );
  });

  // Bỏ class khi thả file ra hoặc kéo ra ngoài
  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(
      eventName,
      () => {
        dropzone.classList.remove("dragover");
      },
      false,
    );
  });

  // Lấy dữ liệu file khi thả vào
  dropzone.addEventListener(
    "drop",
    (e) => {
      let dt = e.dataTransfer;
      let files = dt.files;
      handleFiles(files);
    },
    false,
  );

  function handleFiles(files) {
    if (files.length > 0) {
      console.log(`Bắt đầu xử lý tải lên ${files.length} tệp.`);

      if (!window.uploadGlobalState) {
        window.uploadGlobalState = {
          totalFiles: 0,
          completedFiles: 0,
          totalSize: 0,
          uploadedSize: 0
        };
      }
      
      window.uploadGlobalState.totalFiles += files.length;

      Array.from(files).forEach((file) => {
        window.uploadGlobalState.totalSize += file.size;
        uploadFileWithProgress(file);
      });
      
      if (typeof window.updateMinimizedUploadUI === "function") {
        window.updateMinimizedUploadUI();
      }
    }
  }

  async function uploadFileWithProgress(file) {
    const token =
      typeof checkAuth === "function"
        ? checkAuth()
        : localStorage.getItem("jwt_token");
    if (!token) return;

    // --- KHỞI TẠO GIAO DIỆN UI CHO FILE ĐANG TẢI ---
    const listSection = document.querySelector(".upload-list-section");
    if (!listSection) return;

    const formatSize = (bytes) => {
      if (!bytes) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const template = document.getElementById("upload-item-template");
    let itemCard;

    if (template) {
      itemCard = template.content
        .cloneNode(true)
        .querySelector(".upload-item-card");
      itemCard.querySelector(".item-name").textContent = file.name;
      itemCard.querySelector(".item-name").title = file.name;
      itemCard.querySelector(".item-meta").innerHTML =
        `0 B / ${formatSize(file.size)} &middot; <span class="text-blue thread-count">Chờ...</span>`;
      listSection.appendChild(itemCard);
      // Lấy reference lại vì lúc clone Node chưa nằm trên DOM
      itemCard = listSection.lastElementChild;
    } else {
      console.error("Không tìm thấy template HTML!");
      return;
    }

    const percentEl = itemCard.querySelector(".item-percent");
    const barEl = itemCard.querySelector(".progress-bar");
    const metaEl = itemCard.querySelector(".item-meta");
    const pauseBtn = itemCard.querySelector(".pause-btn");
    const cancelBtn = itemCard.querySelector(".cancel-btn");

    // --- LOGIC TẢI LÊN ---
    const baseUrl =
      typeof API_BASE_URL !== "undefined"
        ? API_BASE_URL
        : "http://localhost:8080/api";
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const maxConcurrent = 3;
    const fileIdentifier = `${file.name}-${file.size}-${file.lastModified}`;

    let uploadedChunks = 0;
    let hasError = false;
    let isPaused = false;
    let isCancelled = false;
    let activeThreadsCount = 0;

    const chunksToUpload = Array.from({ length: totalChunks }, (_, i) => i);

    // Xử lý nút Tạm dừng
    pauseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (isCancelled || uploadedChunks === totalChunks) return;
      isPaused = !isPaused;

      const icon = pauseBtn.querySelector("i");
      if (isPaused) {
        icon.classList.remove("ph-pause-circle");
        icon.classList.add("ph-play-circle");
        percentEl.classList.remove("text-blue");
        percentEl.classList.add("text-warning");
        barEl.classList.remove("bg-blue");
        barEl.classList.add("bg-warning");
      } else {
        icon.classList.remove("ph-play-circle");
        icon.classList.add("ph-pause-circle");
        percentEl.classList.remove("text-warning");
        percentEl.classList.add("text-blue");
        barEl.classList.remove("bg-warning");
        barEl.classList.add("bg-blue");

        // Kích hoạt lại luồng
        const threadsToStart = Math.min(
          maxConcurrent - activeThreadsCount,
          chunksToUpload.length,
        );
        for (let i = 0; i < threadsToStart; i++) {
          uploadNextChunk();
        }
      }
    });

    // Xử lý nút Hủy
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      isCancelled = true;
      hasError = true;
      itemCard.remove(); // Xóa khỏi giao diện
    });

    async function uploadNextChunk() {
      if (hasError || isPaused || isCancelled || chunksToUpload.length === 0)
        return;

      activeThreadsCount++;
      const chunkIndex = chunksToUpload.shift();
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("file", chunk, file.name);
      formData.append("chunkIndex", chunkIndex);
      formData.append("totalChunks", totalChunks);
      formData.append("fileIdentifier", fileIdentifier);
      formData.append("originalName", file.name);

      try {
        const response = await fetch(`${baseUrl}/upload-chunk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) throw new Error(`Lỗi upload phần ${chunkIndex + 1}`);

        activeThreadsCount--;
        if (isCancelled) return;

        uploadedChunks++;
        
        // Cập nhật global state
        const chunkSizeUploaded = chunk.size;
        if (window.uploadGlobalState) {
          window.uploadGlobalState.uploadedSize += chunkSizeUploaded;
          if (typeof window.updateMinimizedUploadUI === "function") {
            window.updateMinimizedUploadUI();
          }
        }

        const percentComplete = Math.round(
          (uploadedChunks / totalChunks) * 100,
        );

        // Cập nhật UI
        percentEl.textContent = `${percentComplete}%`;
        barEl.style.width = `${percentComplete}%`;
        const uploadedSize = Math.min(uploadedChunks * CHUNK_SIZE, file.size);
        metaEl.innerHTML = `${formatSize(uploadedSize)} / ${formatSize(file.size)} &middot; <span class="text-blue">${activeThreadsCount} luồng</span>`;

        // Kiểm tra hoàn thành
        if (uploadedChunks === totalChunks) {
          percentEl.textContent = "Hoàn thành";
          percentEl.style.color = "#16a34a"; // Xanh lá
          barEl.style.backgroundColor = "#16a34a";
          metaEl.innerHTML = `${formatSize(file.size)} / ${formatSize(file.size)} &middot; <span style="color:#16a34a">Xong</span>`;

          pauseBtn.style.display = "none"; // Ẩn nút pause

          if (window.uploadGlobalState) {
            window.uploadGlobalState.completedFiles++;
            if (typeof window.updateMinimizedUploadUI === "function") {
              window.updateMinimizedUploadUI();
            }
          }
          
          // Thêm file vào mockData để hiển thị ngay
          if (!window.mockData) {
            window.mockData = { folders: [], files: [] };
          }
          window.mockData.files.unshift({
            id: Date.now(),
            name: file.name,
            size: file.size,
            updatedAt: "Vừa xong",
            shared: false,
            fileObj: file // Lưu giữ file gốc để xem trước
          });

          if (typeof loadDashboardData === "function") {
            loadDashboardData("my-files");
          }
        } else {
          // Tải chunk tiếp theo
          uploadNextChunk();
        }
      } catch (err) {
        activeThreadsCount--;
        if (!isCancelled) {
          console.error(err);
          hasError = true;
          percentEl.textContent = "Lỗi tải lên";
          percentEl.style.color = "#ef4444";
          barEl.style.backgroundColor = "#ef4444";
        }
      }
    }

    // Bắt đầu tải lên
    const initialThreads = Math.min(maxConcurrent, totalChunks);
    for (let i = 0; i < initialThreads; i++) {
      uploadNextChunk();
    }
  }
}

window.updateMinimizedUploadUI = function() {
  const minTitle = document.querySelector(".upload-minimized .minimized-title");
  const minSubtitle = document.querySelector(".upload-minimized .minimized-subtitle");
  const minProgressText = document.querySelector(".upload-minimized .progress-text");
  const minProgressCircle = document.querySelector(".upload-minimized .circle");
  const modalSubtitle = document.getElementById("modalUploadSubtitle");

  if (!minTitle || !minSubtitle || !minProgressText || !minProgressCircle) return;

  if (!window.uploadGlobalState || window.uploadGlobalState.totalFiles === 0) {
    minTitle.textContent = "Không có tệp nào đang tải";
    minSubtitle.innerHTML = "0 hoàn thành &middot; Nhấn để xem";
    minProgressText.textContent = "0%";
    minProgressCircle.setAttribute("stroke-dasharray", "0, 100");
    if (modalSubtitle) modalSubtitle.innerHTML = "Chưa có tệp nào đang tải";
    return;
  }

  minTitle.textContent = `Đang tải ${window.uploadGlobalState.totalFiles} tệp`;
  minSubtitle.innerHTML = `${window.uploadGlobalState.completedFiles} hoàn thành &middot; Nhấn để xem`;
  if (modalSubtitle) modalSubtitle.innerHTML = `${window.uploadGlobalState.totalFiles} đang tải &middot; ${window.uploadGlobalState.completedFiles} hoàn thành`;

  let percent = 0;
  if (window.uploadGlobalState.totalSize > 0) {
    percent = Math.round((window.uploadGlobalState.uploadedSize / window.uploadGlobalState.totalSize) * 100);
  }

  // Đảm bảo không vượt quá 100%
  percent = Math.min(percent, 100);

  minProgressText.textContent = `${percent}%`;
  minProgressCircle.setAttribute("stroke-dasharray", `${percent}, 100`);
};

/**
 * Xử lý giao diện Upload Modal
 */
function setupUploadModal() {
  const uploadModal = document.getElementById("uploadModal");
  const closeBtn = document.getElementById("closeUploadModal");
  const uploadBtns = document.querySelectorAll(
    ".btn-upload-main, .btn-upload-outline",
  );

  if (!uploadModal) return;

  // Xử lý kéo thả (Drag & Drop) cửa sổ modal
  const header = uploadModal.querySelector(".upload-modal-header");
  let isDragging = false;
  let offsetX, offsetY;

  if (header) {
    header.addEventListener("mousedown", (e) => {
      // Bỏ qua nếu bấm vào nút Đóng
      if (e.target.closest(".close-btn")) return;

      isDragging = true;
      const rect = uploadModal.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      // Khóa vị trí theo left/top để di chuyển, hủy bottom/right mặc định của CSS
      uploadModal.style.right = "auto";
      uploadModal.style.bottom = "auto";
      uploadModal.style.left = rect.left + "px";
      uploadModal.style.top = rect.top + "px";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      uploadModal.style.left = e.clientX - offsetX + "px";
      uploadModal.style.top = e.clientY - offsetY + "px";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  // Đóng modal
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      uploadModal.style.display = "none";
      uploadModal.classList.remove("minimized");
    });
  }

  // Các nút điều khiển trong Footer
  const addFileBtn = document.getElementById("addFileBtn");
  const pauseAllBtn = document.getElementById("pauseAllBtn");
  const ctxRename = document.getElementById("ctxRename");
  const ctxShare = document.getElementById("ctxShareWrap");
  const ctxDelete = document.getElementById("ctxDelete");
  const ctxDownload = document.getElementById("ctxDownload");
  const minimizeBtn = document.getElementById("minimizeBtn");
  const fileInput = document.getElementById("fileInput");
  const uploadMinimized = document.getElementById("uploadMinimized");

  // Context Menu Actions
  if (ctxDownload) {
    ctxDownload.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click(); // Giả lập nút Tải xuống
    });
  }

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  if (pauseAllBtn) {
    let isPausedAll = false;

    // Hàm toggle trạng thái cho 1 item
    const toggleItemPause = (item, forcePause = null) => {
      const btn = item.querySelector(".pause-btn");
      const icon = btn.querySelector("i");
      const percent = item.querySelector(".percent");
      const bar = item.querySelector(".bar");

      const willPause =
        forcePause !== null
          ? forcePause
          : icon.classList.contains("ph-pause-circle");

      if (willPause) {
        icon.classList.remove("ph-pause-circle");
        icon.classList.add("ph-play-circle");
        if (percent) {
          percent.classList.remove("text-blue");
          percent.classList.add("text-warning");
        }
        if (bar) {
          bar.classList.remove("bg-blue");
          bar.classList.add("bg-warning");
        }
      } else {
        icon.classList.remove("ph-play-circle");
        icon.classList.add("ph-pause-circle");
        if (percent) {
          percent.classList.remove("text-warning");
          percent.classList.add("text-blue");
        }
        if (bar) {
          bar.classList.remove("bg-warning");
          bar.classList.add("bg-blue");
        }
      }
    };

    // Lắng nghe sự kiện click cho từng nút pause riêng lẻ
    const pauseBtns = uploadModal.querySelectorAll(".pause-btn");
    pauseBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const item = btn.closest(".upload-item, .thread-item"); // Hỗ trợ cả luồng nhỏ nếu cần
        if (item) toggleItemPause(item);
      });
    });

    // Lắng nghe sự kiện Pause All
    pauseAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      isPausedAll = !isPausedAll;

      const items = uploadModal.querySelectorAll(".upload-item");
      items.forEach((item) => toggleItemPause(item, isPausedAll));

      if (isPausedAll) {
        pauseAllBtn.textContent = "Tiếp tục tất cả";
        pauseAllBtn.classList.add("is-resume");
      } else {
        pauseAllBtn.textContent = "Tạm dừng tất cả";
        pauseAllBtn.classList.remove("is-resume");
      }
    });
  }

  // Thu nhỏ: Ẩn modal chính, hiện nút thu nhỏ (pill popup)
  if (minimizeBtn && uploadMinimized) {
    minimizeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      uploadModal.style.display = "none";
      uploadMinimized.style.display = "flex";
    });
  }

  // Mở rộng lại từ nút thu nhỏ
  if (uploadMinimized) {
    uploadMinimized.addEventListener("click", () => {
      uploadMinimized.style.display = "none";
      uploadModal.style.display = "flex";
    });
  }

  // Click đúp vào header để thu nhỏ (tuỳ chọn thêm)
  if (header && uploadMinimized) {
    header.addEventListener("dblclick", () => {
      uploadModal.style.display = "none";
      uploadMinimized.style.display = "flex";
    });
  }

  // Mở modal khi bấm các nút Tải lên
  uploadBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      uploadModal.style.display = "flex";
      uploadModal.classList.remove("minimized");
    });
  });
}

/**
 * Hàm mẫu để gọi API lấy dữ liệu từ Backend
 * Gọi hàm này khi trang vừa load hoặc khi chuyển đổi giữa tab "Trang chủ" / "Tệp của tôi"
 */
async function loadDashboardData(viewType = "home") {
  try {
    // Gọi API lấy dữ liệu thực tế
    const response = await fetchWithAuth(`/files?view=${viewType}`);

    if (response && response.ok) {
      const data = await response.json();
      // Giả sử Backend trả về JSON: { folders: [...], files: [...] }
      renderFolders(data.folders || []);
      renderFiles(data.files || []);
      return;
    }

    throw new Error(
      "Không lấy được dữ liệu từ API, sử dụng mockData thay thế.",
    );
  } catch (error) {
    console.warn(error.message);

    // Dữ liệu giả lập (Mock Data) fallback để giao diện không bị trống
    if (!window.mockData) {
      window.mockData = {
        folders: [
          {
            id: 1,
            name: "Dự án A (Mock Data)",
            updatedAt: "Hôm nay",
            color: "blue",
          },
          {
            id: 2,
            name: "Tài liệu cá nhân (Mock Data)",
            updatedAt: "Hôm qua",
            color: "green",
          },
        ],
        files: [
          {
            id: 101,
            name: "BaoCao.pdf",
            size: 2500000,
            updatedAt: "10:30 AM",
            shared: false,
          },
          {
            id: 102,
            name: "Data.xlsx",
            size: 1048576,
            updatedAt: "Hôm qua",
            shared: true,
          },
        ],
      };
    }

    // Render dữ liệu ra UI
    renderFolders(window.mockData.folders);
    renderFiles(window.mockData.files);
  }
}
