// frontend/js/file-actions.js
// Mục đích: File JS lớn nhất, xử lý TẤT CẢ tương tác với file/folder:
//   - Context Menu (chuột phải / nút 3 chấm)
//   - Modals: Đổi tên, Chia sẻ
//   - Render card file/folder lên giao diện
//   - Upload file/folder với tiến trình (Chunked Upload)
//   - Drag & Drop
//   - Trash (Thùng rác): xóa, khôi phục, xóa vĩnh viễn
//   - loadDashboardData: hàm tổng dispatch load dữ liệu theo tab


// ================================================================
// BIẾN TOÀN CỤC (State)
// ================================================================

// ID của file/folder đang được người dùng chọn (click chuột phải hoặc click nút ⋮)
// Dùng để các handler trong Context Menu biết cần thao tác trên item nào
let currentTargetId = null;
let currentTargetType = null; // 'file' hoặc 'folder'


// ================================================================
// TIỆN ÍCH FORMAT DỮ LIỆU
// ================================================================

/**
 * formatSize(bytes) - Chuyển bytes thành chuỗi đọc được (B, KB, MB, GB, TB)
 * VD: 1536 → "1.5 KB" | 5242880 → "5.0 MB"
 */
function formatSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k)); // Tìm bậc đơn vị phù hợp
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
// Gán lên window để các file khác (dashboard.js, trash.js...) có thể gọi
window.formatSize = formatSize;

function parseLocalDate(isoString) {
  if (!isoString) return null;
  if (isoString instanceof Date) return isoString;
  if (Array.isArray(isoString)) {
    return new Date(isoString[0], isoString[1] - 1, isoString[2], isoString[3] || 0, isoString[4] || 0, isoString[5] || 0);
  }
  const s = String(isoString).trim();
  const match = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const yyyy = parseInt(match[1]);
    const mm = parseInt(match[2]) - 1;
    const dd = parseInt(match[3]);
    const hh = match[4] !== undefined ? parseInt(match[4]) : 0;
    const min = match[5] !== undefined ? parseInt(match[5]) : 0;
    const ss = match[6] !== undefined ? parseInt(match[6]) : 0;
    return new Date(yyyy, mm, dd, hh, min, ss);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
window.parseLocalDate = parseLocalDate;

function formatSmartDate(isoString) {
  if (!isoString) return "Gần đây";
  try {
    const d = parseLocalDate(isoString);
    if (!d) return String(isoString);

    const now = new Date();
    // Tạo Date chỉ có ngày (bỏ giờ/phút/giây) để so sánh ngày
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // diffDays: số ngày chênh lệch (0 = hôm nay, 1 = hôm qua, ...)
    const diffDays = Math.round((today - targetDate) / (1000 * 60 * 60 * 24));

    // Format giờ:phút với leading zero (VD: 9 → "09")
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const yyyy = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0'); // getMonth() bắt đầu từ 0
    const dd = String(d.getDate()).padStart(2, '0');

    if (diffDays === 0) {
      return `Hôm nay, ${hh}:${mm}`; // Cùng ngày → hiện giờ
    } else if (diffDays === 1) {
      return `Hôm qua, ${hh}:${mm}`; // Hôm qua → hiện giờ
    } else {
      return `${yyyy}-${month}-${dd}`; // Ngày cũ hơn → hiện ngày đầy đủ
    }
  } catch (e) {
    return String(isoString); // Fallback: trả nguyên chuỗi nếu có lỗi
  }
}
// Gán lên window để dùng được ở mọi file
window.formatSmartDate = formatSmartDate;

async function downloadItem(id, type, name) {
  if (!id) return;
  const endpoint = type === 'folder' ? `/folders/${id}/download` : `/files/${id}/download`;
  try {
    const response = await fetchWithAuth(endpoint);
    if (!response || !response.ok) {
      alert("Không thể tải xuống mục này!");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name || (type === 'folder' ? `folder_${id}.zip` : `file_${id}`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
  } catch (err) {
    console.error("Lỗi khi tải xuống:", err);
    alert("Có lỗi xảy ra khi tải xuống!");
  }
}
window.downloadItem = downloadItem;

document.addEventListener("DOMContentLoaded", () => {
  // Lấy tham chiếu đến Context Menu và các Modal overlay
  const contextMenu = document.getElementById("globalContextMenu");  // Menu chuột phải

  // DOM elements của Modals (lớp phủ tối toàn màn hình)
  const renameOverlay = document.getElementById("renameModalOverlay"); // Modal đổi tên
  const shareOverlay = document.getElementById("shareModalOverlay");   // Modal chia sẻ

  // ─── 1. LOGIC ẨN CONTEXT MENU KHI CLICK RA NGOÀI ───
  document.addEventListener("click", (e) => {
    // Nếu click KHÔNG vào menu và KHÔNG vào nút 3 chấm → ẩn menu
    if (
      !e.target.closest(".custom-context-menu") &&
      !e.target.closest(".more-options")
    ) {
      contextMenu.style.display = "none";
      // Xóa class .active của tất cả nút 3 chấm đang nổi bật
      document
        .querySelectorAll(".more-options.active")
        .forEach((el) => el.classList.remove("active"));
    }
  });

  // ─── 2. HÀM MỞ CONTEXT MENU ───
  // Gán lên window để renderFolders/renderFiles có thể gọi từ onclick inline HTML
  // VD: onclick="window.openContextMenu(event, 123, 'file')"
  window.openContextMenu = function (e, id, type) {
    e.stopPropagation(); // Ngăn sự kiện lan ra document (tránh menu bị đóng ngay)

    // Lưu item đang được chọn vào biến state toàn cục
    currentTargetId = id;   // ID của file/folder
    currentTargetType = type; // 'file' hoặc 'folder'

    // Lấy quyền của file/folder từ window.currentLoadedData
    let itemPerm = "OWNER";
    if (window.currentLoadedData) {
      if (type === 'folder') {
        let list = window.currentLoadedData.folders || [];
        if (window.currentLoadedData.subfolders) list = list.concat(window.currentLoadedData.subfolders);
        const item = list.find(f => (f.folderId || f.id) == id);
        if (item && item.permission) itemPerm = item.permission;
      } else {
        let list = window.currentLoadedData.files || [];
        const item = list.find(f => (f.fileId || f.id) == id);
        if (item && item.permission) itemPerm = item.permission;
      }
    }
    window.currentTargetPermission = itemPerm.toUpperCase();

    // Bỏ nổi bật tất cả nút 3 chấm đang active trước đó
    document
      .querySelectorAll(".more-options.active")
      .forEach((el) => el.classList.remove("active"));

    // Nổi bật nút 3 chấm vừa được click (e.currentTarget = nút ⋮)
    const btn = e.currentTarget;
    btn.classList.add("active");

    // Hiện context menu
    contextMenu.style.display = "block";

    // --- Tính toán vị trí hiển thị menu (tránh bị tràn ra ngoài màn hình) ---
    const btnRect = btn.getBoundingClientRect(); // Vị trí của nút ⋮ trên màn hình
    let left = btnRect.right + 10;  // Mặc định: hiện bên PHẢI nút ⋮, cách 10px
    let top = btnRect.top;          // Cùng chiều cao với nút ⋮

    // Nếu menu bị tràn ra lề PHẢI màn hình → lật sang hiện ở bên TRÁI nút ⋮
    if (left + contextMenu.offsetWidth > window.innerWidth) {
      left = btnRect.left - contextMenu.offsetWidth - 10;
    }
    // Nếu menu bị tràn xuống lề DƯỚI màn hình → dịch lên trên cho vừa
    if (top + contextMenu.offsetHeight > window.innerHeight) {
      top = window.innerHeight - contextMenu.offsetHeight - 10;
    }

    contextMenu.style.left = left + "px";
    contextMenu.style.top = top + "px";

    // --- Ẩn/Hiện nút theo VIEW hiện tại ---
    const ctxDelete = document.getElementById("ctxDelete");       // "Chuyển vào thùng rác"
    const ctxRestore = document.getElementById("ctxRestore");     // "Khôi phục"
    const ctxDeletePerm = document.getElementById("ctxDeletePermanent"); // "Xóa vĩnh viễn"

    if (window.currentViewType === "trash") {
      // Đang ở Thùng rác → Ẩn "Xóa", Hiện "Khôi phục" và "Xóa vĩnh viễn"
      if (ctxDelete) ctxDelete.style.display = "none";
      if (ctxRestore) ctxRestore.style.display = "flex";
      if (ctxDeletePerm) ctxDeletePerm.style.display = "flex";
    } else {
      // View bình thường → Hiện "Xóa", Ẩn "Khôi phục" và "Xóa vĩnh viễn"
      if (ctxDelete) ctxDelete.style.display = "flex";
      if (ctxRestore) ctxRestore.style.display = "none";
      if (ctxDeletePerm) ctxDeletePerm.style.display = "none";
    }
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
    const data = window.currentLoadedData || window.mockData;
    if (data) {
      if (currentTargetType === 'file') {
        const file = (data.files || []).find(f => (f.fileId || f.id) == currentTargetId);
        if (file) currentName = file.fileName || file.name;
      } else if (currentTargetType === 'folder') {
        const folders = data.folders || data.subfolders || [];
        const folder = folders.find(f => (f.folderId || f.id) == currentTargetId);
        if (folder) currentName = folder.folderName || folder.name;
      }
    }

    document.getElementById("renameInput").value = currentName || "";
    renameOverlay.style.display = "flex";
    document.getElementById("renameInput").focus();
  });

  // Lấy danh sách người dùng được chia sẻ từ backend
  // Lấy danh sách người dùng được chia sẻ từ backend
  async function fetchSharedUsers(itemId, itemType) {
    const container = document.getElementById("sharedUsersListContainer");
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 13px; padding: 20px;">Đang tải danh sách...</div>';

    try {
      const queryParam = itemType === 'file' ? `fileId=${itemId}` : `folderId=${itemId}`;
      const res = await fetchWithAuth(`/shares/users?${queryParam}`);
      if (!res || !res.ok) throw new Error("API Lỗi");
      let sharedUsers = await res.json();
      if (!Array.isArray(sharedUsers)) sharedUsers = [];

      // Tự động kiểm tra và bổ sung dòng Chủ sở hữu (OWNER) ở vị trí đầu tiên
      const hasOwnerInList = sharedUsers.some(s => s.permission === 'OWNER');
      if (!hasOwnerInList) {
        let ownerEmail = null;
        if (window.currentLoadedData) {
          const list = itemType === 'file' ? (window.currentLoadedData.files || []) : (window.currentLoadedData.subfolders || window.currentLoadedData.folders || []);
          const currentItem = list.find(i => i.id == itemId);
          if (currentItem && currentItem.userEmail) {
            ownerEmail = currentItem.userEmail;
          }
        }
        if (!ownerEmail && sharedUsers.length > 0 && sharedUsers[0].sharedByEmail) {
          ownerEmail = sharedUsers[0].sharedByEmail;
        }

        if (ownerEmail) {
          sharedUsers.unshift({
            id: -1,
            sharedToEmail: ownerEmail,
            permission: 'OWNER'
          });
        }
      }

      if (!sharedUsers || sharedUsers.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 13px; padding: 20px;">Chưa chia sẻ với ai.</div>';
        return;
      }

      container.innerHTML = sharedUsers.map(share => {
        const userEmail = share.sharedToEmail || share.sharedByEmail || "User";
        const initial = userEmail.charAt(0).toUpperCase();
        const perm = share.permission;
        const shareId = share.id;

        if (perm === 'OWNER') {
          return `
            <div class="shared-user-item">
              <div class="shared-user-info">
                <div class="shared-user-avatar" style="background-color: #0ea5e9;">${initial}</div>
                <div class="shared-user-details">
                  <span class="su-name">${userEmail.split('@')[0]}</span>
                  <span class="su-email">${userEmail}</span>
                </div>
              </div>
              <span class="shared-owner-badge" style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 12px;">Chủ sở hữu</span>
            </div>
          `;
        }

        return `
          <div class="shared-user-item">
            <div class="shared-user-info">
              <div class="shared-user-avatar" style="background-color: #0ea5e9;">${initial}</div>
              <div class="shared-user-details">
                <span class="su-name">${userEmail.split('@')[0]}</span>
                <span class="su-email">${userEmail}</span>
              </div>
            </div>
            <select class="share-role-select-inline" onchange="window.updateShareRole('${shareId}', this.value)">
              <option value="VIEW" ${perm === 'VIEW' ? 'selected' : ''}>Người xem</option>
              <option value="EDIT" ${perm === 'EDIT' ? 'selected' : ''}>Người chỉnh sửa</option>
              <option value="REMOVE" class="text-danger">Xóa quyền</option>
            </select>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      container.innerHTML = '<div style="color: red; text-align: center; font-size: 13px; padding: 20px;">Lỗi tải dữ liệu người dùng.</div>';
    }
  }

  // Khai báo hàm updateShareRole ở dạng global để có thể gọi từ onchange trong HTML
  window.updateShareRole = async function (shareId, newRole) {
    try {
      if (newRole === 'REMOVE') {
        const res = await fetchWithAuth(`/shares/${shareId}`, { method: "DELETE" });
        if (res && res.ok) {
          fetchSharedUsers(currentTargetId, currentTargetType);
          loadDashboardData(window.currentViewType || "home"); // Reload UI
        }
      } else {
        const res = await fetchWithAuth(`/shares/${shareId}`, {
          method: "PUT",
          body: JSON.stringify({ permission: newRole })
        });
        if (res && res.ok) {
          fetchSharedUsers(currentTargetId, currentTargetType);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi cập nhật quyền.");
    }
  };

  document.getElementById("ctxShare").addEventListener("click", async () => {
    contextMenu.style.display = "none";
    shareOverlay.style.display = "flex";
    if (typeof clearShareError === "function") clearShareError();
    const emailInput = document.getElementById("shareEmailInput");
    if (emailInput) emailInput.value = "";
    
    // Khóa vùng nhập nếu người dùng chỉ có quyền VIEWER
    const shareRoleSelect = document.getElementById("shareRoleSelect");
    const addShareUserBtn = document.getElementById("addShareUserBtn");
    const isViewer = window.currentTargetPermission === "VIEWER" || window.currentTargetPermission === "VIEW";
    
    if (emailInput) {
      emailInput.disabled = isViewer;
      emailInput.placeholder = isViewer ? "Bạn không có quyền chia sẻ" : "Thêm người bằng email...";
      // Tùy chỉnh màu nền cho ô input khi bị disable để dễ nhận biết
      emailInput.style.backgroundColor = isViewer ? "#f1f5f9" : "white";
    }
    if (shareRoleSelect) {
      shareRoleSelect.disabled = isViewer;
      shareRoleSelect.style.backgroundColor = isViewer ? "#f1f5f9" : "white";
    }
    if (addShareUserBtn) {
      addShareUserBtn.disabled = isViewer;
      // Làm mờ nút Thêm nếu bị khóa
      addShareUserBtn.style.opacity = isViewer ? "0.5" : "1";
      addShareUserBtn.style.cursor = isViewer ? "not-allowed" : "pointer";
    }

    // Lấy thông tin từ backend
    await fetchSharedUsers(currentTargetId, currentTargetType);
  });

  document.getElementById("ctxDownload").addEventListener("click", (e) => {
    e.preventDefault();
    contextMenu.style.display = "none";
    if (currentTargetId && currentTargetType) {
      downloadItem(currentTargetId, currentTargetType);
    }
  });

  document.getElementById("ctxCopyLink").addEventListener("click", () => {
    contextMenu.style.display = "none";
    const link = `https://vaultdrive.com/share/${currentTargetId}`;
    navigator.clipboard.writeText(link)
      .then(() => alert(`Đã sao chép liên kết:\n${link}`))
      .catch(() => alert("Trình duyệt không hỗ trợ sao chép tự động!"));
  });

  // Logic Thùng rác
  document.getElementById("ctxDelete").addEventListener("click", async () => {
    const contextMenu = document.getElementById("globalContextMenu");
    contextMenu.style.display = "none";
    if (!currentTargetId) return;

    try {
      let endpoint = currentTargetType === 'folder'
        ? `/folders/${currentTargetId}/trash`
        : `/files/${currentTargetId}/trash`;

      const response = await fetchWithAuth(endpoint, { method: "PATCH" });

      if (response && response.ok) {
        // Tải lại giao diện hiện tại
        loadDashboardData(window.currentViewType || "home");
        if (typeof window.renderStorageInfo === "function") window.renderStorageInfo();
      } else {
        alert("Có lỗi xảy ra khi xóa!");
      }
    } catch (err) {
      console.error(err);

      // Fallback mockdata
      if (window.mockData) {
        if (currentTargetType === 'file') {
          window.mockData.files = window.mockData.files.filter(f => f.id !== currentTargetId);
        } else {
          window.mockData.folders = window.mockData.folders.filter(f => f.id !== currentTargetId);
        }
        renderFolders(window.mockData.folders);
        renderFiles(window.mockData.files);
      }
    }
  });

  document.getElementById("ctxRestore")?.addEventListener("click", async () => {
    const contextMenu = document.getElementById("globalContextMenu");
    contextMenu.style.display = "none";
    if (!currentTargetId) return;

    try {
      let endpoint = currentTargetType === 'folder'
        ? `/folders/${currentTargetId}/restore`
        : `/files/${currentTargetId}/restore`;

      const response = await fetchWithAuth(endpoint, { method: "PATCH" });
      if (response && response.ok) {
        loadDashboardData(window.currentViewType || "home");
      }
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById("ctxDeletePermanent")?.addEventListener("click", async () => {
    const contextMenu = document.getElementById("globalContextMenu");
    contextMenu.style.display = "none";
    if (!currentTargetId) return;

    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn mục này không? Không thể khôi phục!")) {
      return;
    }

    try {
      let endpoint = currentTargetType === 'folder'
        ? `/folders/${currentTargetId}/permanent`
        : `/files/${currentTargetId}/permanent`;

      const response = await fetchWithAuth(endpoint, { method: "DELETE" });
      if (response && response.ok) {
        loadDashboardData(window.currentViewType || "home");
        if (typeof window.renderStorageInfo === "function") window.renderStorageInfo();
      }
    } catch (err) {
      console.error(err);
    }
  });

  // 3. Logic đóng mở Rename Modal
  document
    .getElementById("closeRenameModal")
    .addEventListener("click", () => (renameOverlay.style.display = "none"));
  document
    .getElementById("cancelRenameBtn")
    .addEventListener("click", () => (renameOverlay.style.display = "none"));
  document.getElementById("confirmRenameBtn").addEventListener("click", async () => {
    const newName = document.getElementById("renameInput").value.trim();
    if (!newName || !currentTargetId) return;

    try {
      const endpoint = currentTargetType === 'folder'
        ? `/folders/${currentTargetId}/rename`
        : `/files/${currentTargetId}/rename`;

      const response = await fetchWithAuth(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });

      if (response && response.ok) {
        loadDashboardData(window.currentViewType || "home");
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.message || "Không thể đổi tên!");
      }
    } catch (err) {
      console.error("Lỗi khi đổi tên:", err);
      alert("Lỗi kết nối khi đổi tên!");
    } finally {
      renameOverlay.style.display = "none";
    }
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

  function showShareError(msg) {
    const errorLabel = document.getElementById("shareErrorMsg");
    const emailInput = document.getElementById("shareEmailInput");
    if (errorLabel) {
      errorLabel.textContent = msg;
      errorLabel.style.display = "block";
    }
    if (emailInput) {
      emailInput.classList.add("input-error");
    }
  }

  function clearShareError() {
    const errorLabel = document.getElementById("shareErrorMsg");
    const emailInput = document.getElementById("shareEmailInput");
    if (errorLabel) {
      errorLabel.textContent = "";
      errorLabel.style.display = "none";
    }
    if (emailInput) {
      emailInput.classList.remove("input-error");
    }
  }

  const shareEmailInputEl = document.getElementById("shareEmailInput");
  if (shareEmailInputEl) {
    shareEmailInputEl.addEventListener("input", clearShareError);
  }

  document.getElementById("addShareUserBtn").addEventListener("click", async () => {
    clearShareError();
    const emailInput = document.getElementById("shareEmailInput");
    const roleSelect = document.getElementById("shareRoleSelect");
    const email = emailInput.value.trim();
    const role = roleSelect.value;

    if (!email) {
      showShareError("Vui lòng nhập email người nhận!");
      emailInput.focus();
      return;
    }

    if (!currentTargetId || !currentTargetType) return;

    try {
      const body = {
        fileId: currentTargetType === 'file' ? currentTargetId : null,
        folderId: currentTargetType === 'folder' ? currentTargetId : null,
        recipientEmail: email,
        permission: role === 'EDITOR' ? 'EDIT' : (role === 'EDIT' ? 'EDIT' : 'VIEW')
      };
      const res = await fetchWithAuth("/shares", {
        method: "POST",
        body: JSON.stringify(body)
      });

      if (res && res.ok) {
        emailInput.value = ""; // Xóa form
        clearShareError();
        fetchSharedUsers(currentTargetId, currentTargetType);
        loadDashboardData(window.currentViewType || "home"); // Reload UI
      } else {
        let errorMsg = "Lỗi chia sẻ, có thể email không tồn tại hoặc lỗi mạng.";
        if (res) {
          try {
            const errData = await res.json();
            if (errData && errData.message) {
              errorMsg = errData.message;
            }
          } catch (e) { }
        }
        showShareError(errorMsg);
      }
    } catch (err) {
      console.error(err);
      showShareError("Lỗi kết nối khi gửi yêu cầu chia sẻ.");
    }
  });
});

// ================================================================
// RENDER FILE & FOLDER
// Các hàm này nhận dữ liệu từ backend và tạo ra HTML card cho từng item
// ================================================================

/**
 * renderFolders(folders, viewType) - Render danh sách thư mục vào .grid-folders
 * @param {Array}  folders  - Mảng object thư mục (từ backend hoặc mockData)
 * @param {string} viewType - Tab hiện tại: 'home' | 'shared' | 'trash'
 *
 * Mỗi folder được render thành một .folder-card với:
 *   - Icon thư mục màu ngẫu nhiên
 *   - Tên thư mục
 *   - Ngày sửa
 *   - Badge trạng thái: Riêng tư / Đã chia sẻ / Được chia sẻ
 *   - Avatar người chia sẻ (chỉ ở tab 'shared')
 *   - Nút 3 chấm để mở Context Menu
 */
function renderFolders(folders, viewType = "home") {
  const foldersContainer = document.querySelector(".grid-folders");
  foldersContainer.innerHTML = ""; // Xóa dữ liệu cũ (hoặc dữ liệu mẫu)

  if (!folders || folders.length === 0) {
    foldersContainer.innerHTML =
      '<p style="color: var(--text-muted); font-size: 14px;">Không có thư mục nào.</p>';
    return;
  }

  // Format Date (YYYY-MM-DD)
  const formatDate = (isoString) => {
    if (!isoString) return "Gần đây";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return isoString;
    }
  };

  folders.forEach((folder) => {
    // Tùy chọn màu sắc icon dựa vào loại thư mục hoặc ngẫu nhiên
    const colors = ["blue", "purple", "cyan", "green"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const folderCard = document.createElement("div");
    folderCard.className = "folder-card";
    
    // Lưu ID thư mục để xử lý sự kiện click sau này (Hỗ trợ cả object shared)
    const folderId = folder.folderId || folder.id;
    folderCard.dataset.id = folderId;
    const folderName = folder.folderName || folder.name || "Thư mục không tên";

    const displayDate = formatSmartDate(folder.updatedAt || folder.createdAt);
    const isSharedVal = folder.isShared !== undefined ? folder.isShared : folder.shared;
    const folderPerm = folder.permission;
    let folderBadgeText = "Riêng tư";
    let folderBadgeClass = "shared-badge";

    if (viewType === "shared" || (folderPerm && folderPerm !== "OWNER")) {
      const rawPerm = String(folderPerm || "VIEW").toUpperCase();
      const isEdit = rawPerm === "EDIT" || rawPerm === "EDITOR";
      folderBadgeText = viewType === "shared" ? (isEdit ? "Chỉnh sửa" : "Xem") : "Được chia sẻ";
      folderBadgeClass = "shared-badge active shared-received";
    } else if (isSharedVal) {
      folderBadgeText = "Đã chia sẻ";
      folderBadgeClass = "shared-badge active";
    }

    let avatarHtml = "";
    if (viewType === "shared") {
      const sharerName = typeof formatSharerName === 'function' ? formatSharerName(folder) : (folder.ownerName || "Ai đó");
      const initials = typeof getInitials === 'function' ? getInitials(sharerName) : "U";
      const avatarColors = ["avatar-bg-blue", "avatar-bg-pink", "avatar-bg-orange", "avatar-bg-emerald", "avatar-bg-purple", "avatar-bg-cyan"];
      const colorIndex = typeof hashCode === 'function' ? Math.abs(hashCode(sharerName)) % avatarColors.length : 0;
      const avatarColor = avatarColors[colorIndex];
      avatarHtml = `
        <div class="shared-user-meta">
          <div class="shared-user-avatar ${avatarColor}">${initials}</div>
          <span class="shared-user-name" title="${sharerName}">${sharerName}</span>
        </div>
      `;
    }

    folderCard.innerHTML = `
      <div class="more-options" onclick="window.openContextMenu(event, ${folderId}, 'folder')">
        <i class="ph-bold ph-dots-three-vertical"></i>
      </div>
      <i class="ph-fill ph-folder folder-icon ${folder.color || randomColor}"></i>
      <div class="file-info-main">
        <div class="folder-name" title="${folderName}">${folderName}</div>
        <div class="file-meta-mobile">${displayDate}</div>
        <div class="grid-shared-badge">
          <span class="${folderBadgeClass}">${folderBadgeText}</span>
        </div>
        ${avatarHtml}
      </div>
      <div class="file-meta-col folder-meta-col file-date">${displayDate}</div>
      <div class="file-meta-col folder-meta-col file-size"></div>
    `;

    // Tự động kiểm tra nếu folder chính chủ đã được chia sẻ cho người khác
    if ((!folderPerm || folderPerm === "OWNER") && !isSharedVal && viewType !== "shared") {
      fetchWithAuth(`/shares/users?folderId=${folderId}`)
        .then(async (res) => {
          if (res && res.ok) {
            const users = await res.json();
            const recipients = users.filter((u) => u.permission !== "OWNER");
            if (recipients.length > 0) {
              const badges = folderCard.querySelectorAll(".shared-badge");
              badges.forEach((b) => {
                b.textContent = "Đã chia sẻ";
                b.className = "shared-badge active";
              });
            }
          }
        })
        .catch(() => { });
    }

    // Thêm sự kiện click vào thư mục để mở nội dung thư mục
    folderCard.addEventListener("click", (e) => {
      if (e.target.closest(".more-options")) return;
      if (typeof window.openFolder === "function") {
        window.openFolder(folderId, folderName);
      }
    });

    foldersContainer.appendChild(folderCard);
  });
}

/**
 * renderFiles(files, viewType) - Render danh sách tệp tin vào .grid-files
 * @param {Array}  files    - Mảng object file (từ backend hoặc mockData)
 * @param {string} viewType - Tab hiện tại: 'home' | 'shared' | 'trash'
 *
 * Mỗi file được render thành .file-card với:
 *   - Icon loại file (pdf/img/doc/xls/vid/zip) + màu phù hợp
 *   - Tên, ngày sửa, kích thước
 *   - Badge trạng thái chia sẻ
 *   - Avatar người chia sẻ (chỉ ở tab 'shared')
 *   - Click để preview/download file
 *   - Nút 3 chấm để mở Context Menu
 */
function renderFiles(files, viewType = "home") {
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

  // Định dạng kích thước file
  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  files.forEach((file) => {
    const fileCard = document.createElement("div");
    fileCard.className = "file-card";
    
    // Lưu ID tệp tin để xử lý sự kiện (Hỗ trợ object shared)
    const fileId = file.fileId || file.id;
    fileCard.dataset.id = fileId;

    // Lấy tên từ backend (fileName) hoặc mockData (name)
    const displayFileName = file.fileName || file.name || "Không tên";

    // Xác định icon và màu sắc dựa trên phần mở rộng của file
    let iconClass = "ph-file";
    let colorClass = "file-default";
    const ext = displayFileName.split(".").pop().toLowerCase();

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

    // Backend: sizeBytes, isShared. Mock: size, shared
    const fileSizeVal = file.sizeBytes !== undefined ? file.sizeBytes : file.size;
    const displaySize = formatSize(fileSizeVal);
    const isSharedVal = file.isShared !== undefined ? file.isShared : file.shared;
    const filePerm = file.permission;
    let fileBadgeText = "Riêng tư";
    let fileBadgeClass = "shared-badge";

    if (viewType === "shared" || (filePerm && filePerm !== "OWNER")) {
      const rawPerm = String(filePerm || "VIEW").toUpperCase();
      const isEdit = rawPerm === "EDIT" || rawPerm === "EDITOR";
      fileBadgeText = viewType === "shared" ? (isEdit ? "Chỉnh sửa" : "Xem") : "Được chia sẻ";
      fileBadgeClass = "shared-badge active shared-received";
    } else if (isSharedVal) {
      fileBadgeText = "Đã chia sẻ";
      fileBadgeClass = "shared-badge active";
    }

    let avatarHtml = "";
    if (viewType === "shared") {
      const sharerName = typeof formatSharerName === 'function' ? formatSharerName(file) : (file.ownerName || "Ai đó");
      const initials = typeof getInitials === 'function' ? getInitials(sharerName) : "U";
      const avatarColors = ["avatar-bg-blue", "avatar-bg-pink", "avatar-bg-orange", "avatar-bg-emerald", "avatar-bg-purple", "avatar-bg-cyan"];
      const colorIndex = typeof hashCode === 'function' ? Math.abs(hashCode(sharerName)) % avatarColors.length : 0;
      const avatarColor = avatarColors[colorIndex];
      avatarHtml = `
        <div class="shared-user-meta">
          <div class="shared-user-avatar ${avatarColor}">${initials}</div>
          <span class="shared-user-name" title="${sharerName}">${sharerName}</span>
        </div>
      `;
    }

    // Format Date (YYYY-MM-DD)
    const formatDate = (isoString) => {
      if (!isoString) return "Gần đây";
      try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      } catch (e) {
        return isoString;
      }
    };

    const displayDate = formatSmartDate(file.updatedAt || file.createdAt);

    fileCard.innerHTML = `
      <div class="more-options" onclick="window.openContextMenu(event, ${fileId}, 'file')">
        <i class="ph-bold ph-dots-three-vertical"></i>
      </div>
      <div class="file-icon-box ${colorClass}">
        <i class="ph-fill ${iconClass}"></i>
      </div>
      <div class="file-info-main">
        <div class="file-name" title="${displayFileName}">${displayFileName}</div>
        <div class="file-meta-mobile">${displayDate} &middot; ${displaySize}</div>
        <div class="grid-shared-badge">
          <span class="${fileBadgeClass}">${fileBadgeText}</span>
        </div>
        ${avatarHtml}
      </div>
      <div class="file-meta-col file-date">${displayDate}</div>
      <div class="file-meta-col file-size">${displaySize}</div>
      <div class="file-meta-col file-shared">
        <span class="${fileBadgeClass}">${fileBadgeText}</span>
      </div>
    `;

    // Tự động kiểm tra nếu file chính chủ đã được chia sẻ cho người khác
    if ((!filePerm || filePerm === "OWNER") && !isSharedVal && viewType !== "shared") {
      fetchWithAuth(`/shares/users?fileId=${fileId}`)
        .then(async (res) => {
          if (res && res.ok) {
            const users = await res.json();
            const recipients = users.filter((u) => u.permission !== "OWNER");
            if (recipients.length > 0) {
              const badges = fileCard.querySelectorAll(".shared-badge");
              badges.forEach((b) => {
                b.textContent = "Đã chia sẻ";
                b.className = "shared-badge active";
              });
            }
          }
        })
        .catch(() => { });
    }

    // Sự kiện khi click vào file
    fileCard.addEventListener("click", async (e) => {
      // Bỏ qua nếu bấm vào nút more-options
      if (e.target.closest('.more-options')) return;

      console.log("Xem chi tiết file:", file.id);
      try {
        const token = localStorage.getItem("token");
        const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "http://localhost:8080/api";
        const response = await fetch(`${baseUrl}/files/${file.id}/preview`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 403) {
            alert("Bạn không có quyền xem file này!");
          } else {
            alert("File không tồn tại hoặc đã bị xóa!");
          }
          return;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = objectUrl;

        // Phân loại: Ảnh, PDF, Video -> Mở tab mới. Docx, Xlsx -> Tải xuống
        if (["pdf", "png", "jpg", "jpeg", "gif", "svg", "mp4", "txt"].includes(ext)) {
          a.target = '_blank'; // Mở tab mới
        } else {
          a.download = displayFileName; // Tải xuống
        }

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Dọn dẹp URL sau 10s
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      } catch (err) {
        console.error("Lỗi khi mở file", err);
        alert("Lỗi kết nối khi mở file.");
      }
    });

    filesContainer.appendChild(fileCard);
  });
}

// ================================================================
// UPLOAD LOGIC
// ================================================================

// Chế độ tải lên hiện tại: 'file' (tải file đơn) hoặc 'folder' (tải cả thư mục)
let currentUploadMode = "file";

/**
 * setUploadMode(mode) - Cập nhật UI của Upload Modal theo chế độ tải lên
 * Thay đổi: tiêu đề, văn bản dropzone, văn bản nút Thêm, subtitle
 * @param {string} mode - 'file' hoặc 'folder'
 */
function setUploadMode(mode) {
  currentUploadMode = mode;
  const isFolder = mode === "folder";

  const modalTitle = document.getElementById("uploadModalTitle");
  const modalSubtitle = document.getElementById("modalUploadSubtitle");
  const dropzoneTitle = document.getElementById("dropzoneTitle");
  const addFileBtnText = document.getElementById("addFileBtnText");
  const addFileBtn = document.getElementById("addFileBtn");
  const minimizedTitle = document.getElementById("minimizedTitle");

  const noun = isFolder ? "thư mục" : "tệp";

  if (modalTitle) modalTitle.textContent = `Tải lên ${noun}`;
  if (dropzoneTitle) dropzoneTitle.textContent = `Kéo & thả ${noun} vào đây`;

  if (addFileBtnText) {
    addFileBtnText.textContent = `Thêm ${noun}`;
  } else if (addFileBtn) {
    addFileBtn.innerHTML = `<i class="ph ph-plus"></i> Thêm ${noun}`;
  }

  if (!window.uploadGlobalState || window.uploadGlobalState.totalFiles === 0) {
    if (modalSubtitle) modalSubtitle.textContent = `Chưa có ${noun} nào đang tải`;
    if (minimizedTitle) minimizedTitle.textContent = `Không có ${noun} nào đang tải`;
  } else if (typeof window.updateMinimizedUploadUI === "function") {
    window.updateMinimizedUploadUI();
  }
}

/**
 * setupDragAndDrop() - Gắn các sự kiện Drag & Drop và File Input cho dropzone
 * Hỗ trợ:
 *   - Click vào dropzone → mở hộp thoại chọn file/folder
 *   - Kéo file từ máy tính vào dropzone → bắt đầu tải lên
 *   - Kéo thư mục vào dropzone → tự động chuyển sang chế độ folder
 */
function setupDragAndDrop() {
  const dropzone = document.getElementById("dropzone");         // Vùng kéo thả
  const fileInput = document.getElementById("fileInput");       // Input ẩn chọn file
  const folderInput = document.getElementById("folderInput");   // Input ẩn chọn folder
  const browseBtn = document.getElementById("browseFileBtn");

  if (!dropzone) return;

  function triggerFileOrFolderInput() {
    if (currentUploadMode === "folder" && folderInput) {
      folderInput.click();
    } else if (fileInput) {
      fileInput.click();
    }
  }

  if (browseBtn) {
    browseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerFileOrFolderInput();
    });
  }

  dropzone.addEventListener("click", (e) => {
    if (e.target !== browseBtn && !e.target.closest("#browseFileBtn")) {
      triggerFileOrFolderInput();
    }
  });

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      handleFiles(e.target.files);
      fileInput.value = "";
    });
  }

  if (folderInput) {
    folderInput.addEventListener("change", (e) => {
      handleFiles(e.target.files);
      folderInput.value = "";
    });
  }

  // Xử lý các sự kiện Drag & Drop
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(
      eventName,
      () => dropzone.classList.add("dragover"),
      false,
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(
      eventName,
      () => dropzone.classList.remove("dragover"),
      false,
    );
  });

  dropzone.addEventListener(
    "drop",
    async (e) => {
      let dt = e.dataTransfer;
      if (dt.items && dt.items.length > 0) {
        const filesList = [];
        let detectedFolder = false;

        const processEntry = async (entry, path = "") => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              entry.file((file) => {
                try {
                  Object.defineProperty(file, "relativePath", {
                    value: path + file.name,
                    writable: false,
                  });
                } catch (err) { }
                filesList.push(file);
                resolve();
              });
            });
          } else if (entry.isDirectory) {
            detectedFolder = true;
            const dirReader = entry.createReader();
            const entries = await new Promise((resolve) => {
              dirReader.readEntries((res) => resolve(res));
            });
            for (const child of entries) {
              await processEntry(child, path + entry.name + "/");
            }
          }
        };

        for (let i = 0; i < dt.items.length; i++) {
          const entry = dt.items[i].webkitGetAsEntry ? dt.items[i].webkitGetAsEntry() : null;
          if (entry) {
            await processEntry(entry);
          }
        }

        if (detectedFolder && currentUploadMode !== "folder") {
          setUploadMode("folder");
        }

        if (filesList.length > 0) {
          handleFiles(filesList);
          return;
        }
      }

      let files = dt.files;
      handleFiles(files);
    },
    false,
  );

  function processUploadedFileToFolder(file) {
    if (!window.mockData) {
      window.mockData = { folders: [], files: [] };
    }
    if (!window.mockData.folders) window.mockData.folders = [];
    if (!window.mockData.files) window.mockData.files = [];

    const relPath = file.relativePath || file.webkitRelativePath || "";
    let targetFolderId = window.currentFolderId || null;

    if (relPath && relPath.includes("/")) {
      const parts = relPath.split("/").filter((p) => p.trim().length > 0);
      const folderNames = parts.slice(0, parts.length - 1);
      const fileName = parts[parts.length - 1];

      let parentId = window.currentFolderId || null;

      for (let i = 0; i < folderNames.length; i++) {
        const fName = folderNames[i];
        let existingFolder = window.mockData.folders.find((f) => {
          const fParent = f.parentId === undefined ? null : f.parentId;
          return f.name === fName && fParent === parentId;
        });

        if (!existingFolder) {
          existingFolder = {
            id: Date.now() + Math.floor(Math.random() * 10000) + i,
            name: fName,
            parentId: parentId,
            updatedAt: "Vừa xong",
            color: "blue",
            shared: false,
          };
          window.mockData.folders.unshift(existingFolder);
        }
        parentId = existingFolder.id;
      }
      targetFolderId = parentId;

      const existingFile = window.mockData.files.find((f) => {
        const fFolderId = f.folderId === undefined ? null : f.folderId;
        return f.name === fileName && fFolderId === targetFolderId;
      });

      if (!existingFile) {
        window.mockData.files.unshift({
          id: Date.now() + Math.floor(Math.random() * 100000),
          name: fileName,
          folderId: targetFolderId,
          size: file.size,
          updatedAt: "Vừa xong",
          shared: false,
          fileObj: file,
        });
      }
    } else {
      const existingFile = window.mockData.files.find((f) => {
        const fFolderId = f.folderId === undefined ? null : f.folderId;
        return f.name === file.name && fFolderId === targetFolderId;
      });

      if (!existingFile) {
        window.mockData.files.unshift({
          id: Date.now() + Math.floor(Math.random() * 100000),
          name: file.name,
          folderId: targetFolderId,
          size: file.size,
          updatedAt: "Vừa xong",
          shared: false,
          fileObj: file,
        });
      }
    }
  }
  window.processUploadedFileToFolder = processUploadedFileToFolder;

  function handleFiles(files) {
    if (files.length > 0) {
      console.log(`Bắt đầu xử lý tải lên ${files.length} mục.`);

      if (!window.uploadGlobalState) {
        window.uploadGlobalState = {
          totalFiles: 0,
          completedFiles: 0,
          totalSize: 0,
          uploadedSize: 0
        };
      }

      const folderGroupsMap = new Map();
      const standaloneFiles = [];

      Array.from(files).forEach((file) => {
        const relPath = file.relativePath || file.webkitRelativePath || "";
        if (relPath && relPath.includes("/")) {
          const topFolderName = relPath.split("/")[0].trim();
          if (!folderGroupsMap.has(topFolderName)) {
            folderGroupsMap.set(topFolderName, {
              folderName: topFolderName,
              files: [],
              totalSize: 0
            });
          }
          const group = folderGroupsMap.get(topFolderName);
          group.files.push(file);
          group.totalSize += file.size;
        } else {
          standaloneFiles.push(file);
        }
      });

      // Update global total count based on UI item count (folder cards + single file cards)
      window.uploadGlobalState.totalFiles += (standaloneFiles.length + folderGroupsMap.size);

      // Process folder groups (1 card per top-level folder)
      folderGroupsMap.forEach((group) => {
        window.uploadGlobalState.totalSize += group.totalSize;
        uploadFolderWithProgress(group);
      });

      // Process standalone files (1 card per file)
      standaloneFiles.forEach((file) => {
        window.uploadGlobalState.totalSize += file.size;
        uploadFileWithProgress(file);
      });

      if (typeof window.updateMinimizedUploadUI === "function") {
        window.updateMinimizedUploadUI();
      }
    }
  }

  /**
   * uploadFolderWithProgress(group) - Upload một nhóm file (trong cùng thư mục)
   * Hiển thị 1 card UI cho cả nhóm, tải tối đa 3 file song song (MAX_CONCURRENT_FILES)
   * Hỗ trợ: Tạm dừng, Hủy, Retry từng file, cập nhật tiến trình theo thời gian thực
   * @param {object} group - { folderName, files: [], totalSize }
   */
  async function uploadFolderWithProgress(group) {
    // Lấy JWT token để xác thực API
    const token =
      typeof checkAuth === "function"
        ? checkAuth()                                // Ưu tiên dùng hàm checkAuth của dashboard.js
        : localStorage.getItem("jwt_token");         // Fallback đọc thẳng từ localStorage
    if (!token) return;

    const listSection = document.querySelector(".upload-list-section"); // Container danh sách upload
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
      itemCard.querySelector(".item-name").textContent = group.folderName;
      itemCard.querySelector(".item-name").title = group.folderName;

      const typeIcon = itemCard.querySelector(".item-type-icon");
      if (typeIcon) typeIcon.className = "ph-fill ph-folder item-type-icon";

      itemCard.querySelector(".item-meta").innerHTML =
        `0 / ${group.files.length} tệp &middot; 0 B / ${formatSize(group.totalSize)} &middot; <span class="text-blue thread-count">Đang chờ...</span>`;
      listSection.appendChild(itemCard);
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

    const baseUrl =
      typeof API_BASE_URL !== "undefined"
        ? API_BASE_URL
        : "http://localhost:8080/api";

    let isPaused = false;
    let isCancelled = false;
    let completedFilesCount = 0;
    let failedFilesCount = 0;

    const fileUploadedBytesMap = new Map();

    pauseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (isCancelled || completedFilesCount + failedFilesCount === group.files.length) return;
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
      }
    });

    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      isCancelled = true;
      itemCard.remove();
    });

    function updateFolderUI() {
      if (isCancelled) return;

      let totalUploadedBytes = 0;
      fileUploadedBytesMap.forEach((bytes) => {
        totalUploadedBytes += bytes;
      });

      let percent = 0;
      if (group.totalSize > 0) {
        percent = Math.min(100, Math.round((totalUploadedBytes / group.totalSize) * 100));
      }

      percentEl.textContent = `${percent}%`;
      barEl.style.width = `${percent}%`;
      metaEl.innerHTML = `${completedFilesCount} / ${group.files.length} tệp &middot; ${formatSize(totalUploadedBytes)} / ${formatSize(group.totalSize)} &middot; <span class="text-blue">Đang tải...</span>`;
    }

    // --- UPLOAD SONG SONG TỐI ĐA 3 FILE (CONCURRENT QUEUE) ---
    const queue = [...group.files];       // Hàng đợi các file chưa tải
    const MAX_CONCURRENT_FILES = 3;       // Giới hạn 3 file tải đồng thời (tránh quá tải server)
    let activeFiles = 0;                  // Số file đang tải hiện tại

    return new Promise((resolve) => {
      function processNextFile() {
        if (isCancelled) {
          resolve();
          return;
        }

        if (queue.length === 0 && activeFiles === 0) {
          if (!isCancelled) {
            percentEl.textContent = "Hoàn thành";
            percentEl.style.color = "#16a34a";
            barEl.style.backgroundColor = "#16a34a";
            metaEl.innerHTML = `${completedFilesCount} / ${group.files.length} tệp &middot; ${formatSize(group.totalSize)} &middot; <span style="color:#16a34a">Xong</span>`;
            pauseBtn.style.display = "none";

            if (window.uploadGlobalState) {
              window.uploadGlobalState.completedFiles++;
              if (typeof window.updateMinimizedUploadUI === "function") {
                window.updateMinimizedUploadUI();
              }
            }

            if (typeof loadDashboardData === "function") {
              loadDashboardData(window.currentViewType || "home");
            }
            if (typeof window.renderStorageInfo === "function") {
              window.renderStorageInfo();
            }
            if (typeof fetchNotifications === "function") {
              fetchNotifications();
            }
          }
          resolve();
          return;
        }

        while (activeFiles < MAX_CONCURRENT_FILES && queue.length > 0) {
          if (isPaused || isCancelled) break;

          const file = queue.shift();
          activeFiles++;

          uploadSingleFileInFolder(
            file,
            baseUrl,
            token,
            fileUploadedBytesMap,
            updateFolderUI,
            () => isPaused,
            () => isCancelled
          )
            .then((success) => {
              activeFiles--;
              if (success) {
                completedFilesCount++;
              } else {
                failedFilesCount++;
              }
              updateFolderUI();
              processNextFile();
            })
            .catch((err) => {
              activeFiles--;
              failedFilesCount++;
              updateFolderUI();
              processNextFile();
            });
        }
      }

      processNextFile();
    });
  }

  /**
   * uploadSingleFileInFolder() - Upload 1 file đơn (thuộc nhóm folder) theo giao thức Chunked Upload:
   *   1. POST /uploads/init → lấy sessionId
   *   2. Chia file thành chunks 5MB
   *   3. POST /uploads/{sessionId}/chunk (từng chunk một, hỗ trợ pause/cancel)
   *   4. POST /uploads/{sessionId}/complete → server ghép lại
   * @returns {boolean} true nếu upload thành công, false nếu lỗi
   */
  async function uploadSingleFileInFolder(
    file,               // File object
    baseUrl,            // URL gốc API
    token,              // JWT token
    fileUploadedBytesMap, // Map lưu bytes đã tải của từng file (để cập nhật UI folder)
    onProgress,         // Callback cập nhật UI tiến trình folder
    getIsPaused,        // Hàm trả về trạng thái tạm dừng (closure)
    getIsCancelled      // Hàm trả về trạng thái hủy (closure)
  ) {
    try {
      // Xác định ID thư mục đích (backend sẽ tạo folder nếu chưa có)
      const relPath = file.relativePath || file.webkitRelativePath;
      let targetFolderId = window.currentFolderId || null;
      if (relPath && relPath.includes("/")) {
        targetFolderId = await getOrCreateFolderIdOnBackend(relPath); // Tạo/lấy folder ID trên backend
      }

      const CHUNK_SIZE = 5 * 1024 * 1024; // Mỗi chunk = 5MB
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE)); // Số lượng chunk cần tải

      const initResponse = await fetch(`${baseUrl}/uploads/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          totalSizeBytes: file.size,
          totalChunks: totalChunks,
          targetFolderId: targetFolderId
        })
      });

      if (!initResponse.ok) {
        console.error("Không thể khởi tạo phiên tải lên cho:", file.name);
        return false;
      }

      const initData = await initResponse.json();
      const sessionId = initData.sessionId;

      let uploadedChunks = 0;
      fileUploadedBytesMap.set(file, 0);

      if (file.size === 0) {
        const formData = new FormData();
        formData.append("file", new Blob([]), file.name);
        formData.append("chunkIndex", 0);

        await fetch(`${baseUrl}/uploads/${sessionId}/chunk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        fileUploadedBytesMap.set(file, 0);
        onProgress();
      } else {
        for (let i = 0; i < totalChunks; i++) {
          if (getIsCancelled()) return false;

          while (getIsPaused()) {
            await new Promise((r) => setTimeout(r, 400));
            if (getIsCancelled()) return false;
          }

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append("file", chunk, file.name);
          formData.append("chunkIndex", i);

          const response = await fetch(`${baseUrl}/uploads/${sessionId}/chunk`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          if (!response.ok) {
            console.error(`Lỗi upload chunk ${i} của file ${file.name}`);
            return false;
          }

          uploadedChunks++;
          const currentUploaded = Math.min(uploadedChunks * CHUNK_SIZE, file.size);
          const prevUploaded = fileUploadedBytesMap.get(file) || 0;
          const delta = currentUploaded - prevUploaded;

          fileUploadedBytesMap.set(file, currentUploaded);

          if (window.uploadGlobalState) {
            window.uploadGlobalState.uploadedSize += delta;
            if (typeof window.updateMinimizedUploadUI === "function") {
              window.updateMinimizedUploadUI();
            }
          }

          onProgress();
        }
      }

      const completeRes = await fetch(`${baseUrl}/uploads/${sessionId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!completeRes.ok) {
        console.error("Lỗi complete cho file:", file.name);
        return false;
      }

      return true;
    } catch (err) {
      console.error("Lỗi khi tải lên tệp trong thư mục:", file.name, err);
      return false;
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
      const displayName = file.name;
      itemCard.querySelector(".item-name").textContent = displayName;
      itemCard.querySelector(".item-name").title = displayName;

      const typeIcon = itemCard.querySelector(".item-type-icon");
      if (typeIcon) {
        let iconClass = "ph-file";
        const ext = file.name.split(".").pop().toLowerCase();
        if (["pdf"].includes(ext)) iconClass = "ph-file-pdf";
        else if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) iconClass = "ph-image";
        else if (["doc", "docx", "txt"].includes(ext)) iconClass = "ph-file-text";
        else if (["xls", "xlsx", "csv"].includes(ext)) iconClass = "ph-file-xls";
        else if (["mp4", "avi", "mov"].includes(ext)) iconClass = "ph-file-video";
        else if (["zip", "rar", "tar", "gz"].includes(ext)) iconClass = "ph-file-zip";

        typeIcon.className = `ph-fill ${iconClass} item-type-icon`;
      }

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
    let sessionId = null;

    const chunksToUpload = Array.from({ length: totalChunks }, (_, i) => i);

    // Xử lý nút Tạm dừng
    pauseBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (isCancelled || uploadedChunks === totalChunks || !sessionId) return;
      isPaused = !isPaused;

      const icon = pauseBtn.querySelector("i");
      if (isPaused) {
        icon.classList.remove("ph-pause-circle");
        icon.classList.add("ph-play-circle");
        percentEl.classList.remove("text-blue");
        percentEl.classList.add("text-warning");
        barEl.classList.remove("bg-blue");
        barEl.classList.add("bg-warning");

        // Gọi API Pause
        try {
          await fetch(`${baseUrl}/uploads/${sessionId}/pause`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        } catch (e) { }

      } else {
        icon.classList.remove("ph-play-circle");
        icon.classList.add("ph-pause-circle");
        percentEl.classList.remove("text-warning");
        percentEl.classList.add("text-blue");
        barEl.classList.remove("bg-warning");
        barEl.classList.add("bg-blue");

        // Gọi API Resume
        try {
          await fetch(`${baseUrl}/uploads/${sessionId}/resume`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        } catch (e) { }

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
    cancelBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      isCancelled = true;
      hasError = true;
      itemCard.remove(); // Xóa khỏi giao diện

      if (sessionId) {
        try {
          await fetch(`${baseUrl}/uploads/${sessionId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        } catch (e) { }
      }
    });

    async function uploadNextChunk() {
      if (hasError || isPaused || isCancelled || chunksToUpload.length === 0 || !sessionId)
        return;

      activeThreadsCount++;
      const chunkIndex = chunksToUpload.shift();
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("file", chunk, file.name);
      formData.append("chunkIndex", chunkIndex);

      try {
        const response = await fetch(`${baseUrl}/uploads/${sessionId}/chunk`, {
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
          try {
            await fetch(`${baseUrl}/uploads/${sessionId}/complete`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (e) {
            console.error("Lỗi khi complete file", e);
          }

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

          if (typeof loadDashboardData === "function") {
            loadDashboardData(window.currentViewType || "home");
          }
          if (typeof window.renderStorageInfo === "function") {
            window.renderStorageInfo();
          }
          if (typeof fetchNotifications === "function") {
            fetchNotifications();
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

    try {
      let targetFolderId = window.currentFolderId || null;
      const relPath = file.relativePath || file.webkitRelativePath;
      if (relPath && relPath.includes("/")) {
        targetFolderId = await getOrCreateFolderIdOnBackend(relPath);
      }

      // Init Upload
      const initResponse = await fetch(`${baseUrl}/uploads/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          totalSizeBytes: file.size,
          totalChunks: totalChunks,
          targetFolderId: targetFolderId
        })
      });

      if (!initResponse.ok) throw new Error("Không thể khởi tạo phiên tải lên");
      const initData = await initResponse.json();
      sessionId = initData.sessionId;

      // Bắt đầu tải lên
      const initialThreads = Math.min(maxConcurrent, totalChunks);
      for (let i = 0; i < initialThreads; i++) {
        uploadNextChunk();
      }
    } catch (e) {
      hasError = true;
      percentEl.textContent = "Lỗi khởi tạo";
      percentEl.style.color = "#ef4444";
      barEl.style.backgroundColor = "#ef4444";
      console.error(e);
    }
  }
}

const folderPromiseCache = new Map();

async function getOrCreateFolderIdOnBackend(relPath) {
  let currentParentId = window.currentFolderId || null;
  if (!relPath || !relPath.includes("/")) {
    return currentParentId;
  }

  const parts = relPath.split("/").filter((p) => p.trim().length > 0);
  const folderNames = parts.slice(0, parts.length - 1);

  for (let i = 0; i < folderNames.length; i++) {
    const fName = folderNames[i];
    const cacheKey = `${currentParentId || 'root'}_${fName}`;

    if (!folderPromiseCache.has(cacheKey)) {
      const parentIdForCall = currentParentId;
      const promise = (async () => {
        try {
          const response = await fetchWithAuth("/folders", {
            method: "POST",
            body: JSON.stringify({
              name: fName,
              parentId: parentIdForCall,
            }),
          });

          if (response && response.ok) {
            const createdFolder = await response.json();
            return createdFolder.id;
          }
        } catch (err) {
          console.warn("Lỗi khi tạo folder trên backend:", err);
        }
        return parentIdForCall;
      })();

      folderPromiseCache.set(cacheKey, promise);
    }

    currentParentId = await folderPromiseCache.get(cacheKey);
  }

  return currentParentId;
}

window.updateMinimizedUploadUI = function () {
  const minTitle = document.getElementById("minimizedTitle") || document.querySelector(".upload-minimized .minimized-title");
  const minSubtitle = document.getElementById("minimizedSubtitle") || document.querySelector(".upload-minimized .minimized-subtitle");
  const minProgressText = document.querySelector(".upload-minimized .progress-text");
  const modalSubtitle = document.getElementById("modalUploadSubtitle");

  const noun = currentUploadMode === "folder" ? "thư mục" : "tệp";

  if (!minTitle || !minSubtitle || !minProgressText) return;

  if (!window.uploadGlobalState || window.uploadGlobalState.totalFiles === 0) {
    minTitle.textContent = currentUploadMode === "folder" ? "Không có thư mục nào đang tải" : "Không có tệp nào đang tải";
    minSubtitle.innerHTML = "0 hoàn thành &middot; Nhấn để xem";
    minProgressText.textContent = "0%";
    const minProgressRing = document.getElementById("minProgressRing") || document.querySelector(".upload-minimized .progress-ring");
    if (minProgressRing) {
      minProgressRing.style.setProperty("--progress", "0%");
    }
    if (modalSubtitle) modalSubtitle.textContent = currentUploadMode === "folder" ? "Chưa có thư mục nào đang tải" : "Chưa có tệp nào đang tải";
    return;
  }

  minTitle.textContent = `Đang tải ${window.uploadGlobalState.totalFiles} ${noun}`;
  minSubtitle.innerHTML = `${window.uploadGlobalState.completedFiles} hoàn thành &middot; Nhấn để xem`;
  if (modalSubtitle) modalSubtitle.innerHTML = `${window.uploadGlobalState.totalFiles} đang tải &middot; ${window.uploadGlobalState.completedFiles} hoàn thành`;

  let percent = 0;
  if (window.uploadGlobalState.totalSize > 0) {
    percent = Math.round((window.uploadGlobalState.uploadedSize / window.uploadGlobalState.totalSize) * 100);
  }

  // Đảm bảo không vượt quá 100%
  percent = Math.min(percent, 100);

  minProgressText.textContent = `${percent}%`;
  const minProgressRing = document.getElementById("minProgressRing") || document.querySelector(".upload-minimized .progress-ring");
  if (minProgressRing) {
    minProgressRing.style.setProperty("--progress", `${percent}%`);
  }
};

function setupUploadDropdowns() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".upload-dropdown-container")) {
      document.querySelectorAll(".upload-dropdown-menu.show").forEach((m) => {
        m.classList.remove("show");
      });
    }
  });

  const containers = document.querySelectorAll(".upload-dropdown-container");
  containers.forEach((container) => {
    const trigger = container.querySelector(".btn-upload-main, .btn-upload-outline");
    const menu = container.querySelector(".upload-dropdown-menu");
    if (!trigger || !menu) return;

    trigger.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isShow = menu.classList.contains("show");
      document.querySelectorAll(".upload-dropdown-menu.show").forEach((m) => m.classList.remove("show"));
      if (!isShow) menu.classList.add("show");
    };

    const fileBtn = menu.querySelector('[data-action="upload-file"]');
    const folderBtn = menu.querySelector('[data-action="upload-folder"]');

    if (fileBtn) {
      fileBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.remove("show");
        setUploadMode("file");
        openUploadModal();
      };
    }

    if (folderBtn) {
      folderBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.remove("show");
        setUploadMode("folder");
        openUploadModal();
      };
    }
  });
}

function openUploadModal() {
  const uploadModal = document.getElementById("uploadModal");
  if (uploadModal) {
    uploadModal.style.display = "flex";
    uploadModal.classList.remove("minimized");
  }
}

/**
 * Xử lý giao diện Upload Modal
 */
function setupUploadModal() {
  const uploadModal = document.getElementById("uploadModal");
  const closeBtn = document.getElementById("closeUploadModal");

  if (!uploadModal) return;

  setupUploadDropdowns();

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
  const ctxDownload = document.getElementById("ctxDownload");
  const minimizeBtn = document.getElementById("minimizeBtn");
  const fileInput = document.getElementById("fileInput");
  const folderInput = document.getElementById("folderInput");
  const uploadMinimized = document.getElementById("uploadMinimized");



  if (addFileBtn) {
    addFileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentUploadMode === "folder" && folderInput) {
        folderInput.click();
      } else if (fileInput) {
        fileInput.click();
      }
    });
  }

  if (pauseAllBtn) {
    let isPausedAll = false;

    // Hàm toggle trạng thái cho 1 item
    const toggleItemPause = (item, forcePause = null) => {
      const btn = item.querySelector(".pause-btn");
      if (!btn) return;
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

    // Lắng nghe sự kiện Pause All
    pauseAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      isPausedAll = !isPausedAll;

      const items = uploadModal.querySelectorAll(".upload-item-card");
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

  // Click đúp vào header để thu nhỏ
  if (header && uploadMinimized) {
    header.addEventListener("dblclick", () => {
      uploadModal.style.display = "none";
      uploadMinimized.style.display = "flex";
    });
  }
}

window.currentFolderId = null;
window.folderPathTrail = [{ id: null, name: "Tệp của tôi" }];

window.openFolder = function (folderId, folderName) {
  window.currentFolderId = folderId;
  if (!window.folderPathTrail) {
    window.folderPathTrail = [{ id: null, name: "Tệp của tôi" }];
  }

  const existingIdx = window.folderPathTrail.findIndex(
    (item) => item.id === folderId
  );
  if (existingIdx !== -1) {
    window.folderPathTrail = window.folderPathTrail.slice(0, existingIdx + 1);
  } else {
    window.folderPathTrail.push({ id: folderId, name: folderName });
  }

  loadDashboardData(window.currentViewType || "home");
};

window.navigateToBreadcrumb = function (index) {
  if (!window.folderPathTrail || index >= window.folderPathTrail.length) return;
  window.folderPathTrail = window.folderPathTrail.slice(0, index + 1);
  const target = window.folderPathTrail[index];
  window.currentFolderId = target.id;
  loadDashboardData(window.currentViewType || "home");
};

function updateBreadcrumbUI() {
  const container = document.getElementById("breadcrumb-container");
  if (!container) return;

  const rootName = window.currentViewType === "shared" ? "Được chia sẻ" :
    window.currentViewType === "trash" ? "Thùng rác" :
      window.currentViewType === "recent" ? "Gần đây" : "Tệp của tôi";

  if (!window.folderPathTrail || window.folderPathTrail.length === 0) {
    window.folderPathTrail = [{ id: null, name: rootName }];
  } else if (window.folderPathTrail.length > 0 && window.folderPathTrail[0].id === null) {
    window.folderPathTrail[0].name = rootName;
  }

  container.innerHTML = window.folderPathTrail
    .map((item, index) => {
      const isLast = index === window.folderPathTrail.length - 1;
      if (isLast) {
        return `<span class="current">${item.name}</span>`;
      } else {
        return `<a href="#" onclick="window.navigateToBreadcrumb(${index}); return false;" class="breadcrumb-link">${item.name}</a> <i class="ph ph-caret-right" style="font-size: 12px; margin-right: 6px; color: #94a3b8;"></i>`;
      }
    })
    .join("");
}

/**
 * Hàm hỗ trợ lấy chữ cái viết tắt của tên người dùng
 */
function getInitials(name) {
  if (!name) return "U";
  const clean = name.trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

/**
 * Hàm hỗ trợ tạo hash màu sắc cho avatar
 */
function hashCode(str) {
  let hash = 0;
  if (!str) return hash;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/**
 * Hàm hỗ trợ lấy tên người chia sẻ từ Object
 */
function formatSharerName(item) {
  if (!item) return "Người dùng VaultDrive";
  if (item.sharedByName) return item.sharedByName;
  if (item.sharedByEmail) {
    const emailStr = String(item.sharedByEmail);
    return emailStr.includes("@") ? emailStr.split("@")[0] : emailStr;
  }
  if (item.ownerName) return item.ownerName;
  if (item.sharedBy && item.sharedBy.fullName) return item.sharedBy.fullName;
  if (item.sharedBy && item.sharedBy.email) return item.sharedBy.email;
  if (item.owner && item.owner.fullName) return item.owner.fullName;
  if (item.owner && item.owner.email) return item.owner.email;
  if (item.sharerName) return item.sharerName;
  return "Người dùng VaultDrive";
}

/**
 * Render giao diện riêng dành cho tab "Được chia sẻ với tôi"
 * Đổ dữ liệu thực tế từ CSDDL / API backend (không vẽ bằng HTML hay dữ liệu giả mockData)
 */
function renderSharedView(sharedList) {
  const contentScroll = document.querySelector(".content-scroll");
  if (!contentScroll) return;

  if (sharedList !== undefined) {
    window.lastSharedData = sharedList;
  } else if (window.lastSharedData !== undefined) {
    sharedList = window.lastSharedData;
  }

  let items = [];
  if (Array.isArray(sharedList)) {
    items = sharedList;
  } else if (sharedList && typeof sharedList === "object") {
    // Đề phòng API trả về dạng { folders: [...], files: [...] } thay vì mảng phẳng
    const f1 = sharedList.folders || sharedList.subfolders || [];
    const f2 = sharedList.files || [];
    items = [...f1, ...f2];
  }
  // Tách riêng Thư mục chia sẻ & Tệp tin chia sẻ từ CSDDL
  const sharedFolders = items.filter(item => item.folderId != null || (item.folderName && item.fileId == null));
  const sharedFiles = items.filter(item => item.fileId != null || (item.fileName && item.folderId == null));

  // Render hoặc cập nhật Hero Banner
  let heroBanner = contentScroll.querySelector(".shared-hero-banner");
  if (!heroBanner) {
    heroBanner = document.createElement("div");
    heroBanner.className = "shared-hero-banner";
    contentScroll.insertBefore(heroBanner, contentScroll.firstChild);
  }

  const totalItems = sharedFolders.length + sharedFiles.length;
  const userMap = {};
  items.forEach(item => {
    const name = formatSharerName(item);
    userMap[name] = true;
  });
  const totalUsers = Object.keys(userMap).length;

  const avatarColors = ["avatar-bg-blue", "avatar-bg-pink", "avatar-bg-orange", "avatar-bg-emerald", "avatar-bg-purple", "avatar-bg-cyan"];
  let avatarIndex = 0;
  let stackHtml = "";
  Object.keys(userMap).slice(0, 5).forEach(name => {
    const initials = getInitials(name);
    const colorClass = avatarColors[avatarIndex % avatarColors.length];
    stackHtml += `<div class="stack-avatar ${colorClass}">${initials}</div>`;
    avatarIndex++;
  });

  heroBanner.innerHTML = `
    <div class="shared-hero-info">
      <div class="shared-hero-title">Được chia sẻ</div>
      <div class="shared-hero-subtitle">${totalItems} tệp từ ${totalUsers} người dùng</div>
    </div>
    <div class="shared-avatar-stack">
      ${stackHtml}
    </div>
  `;
  heroBanner.style.display = "flex";

  // Cập nhật số lượng tệp chia sẻ lên Sidebar (Thanh menu bên trái)
  const sidebarBadge = document.querySelector('.nav-item[data-view="shared"] .badge');
  if (sidebarBadge) {
    sidebarBadge.textContent = totalItems;
  }

  // Hiển thị lại các tiêu đề section mặc định (THƯ MỤC, TỆP TIN) vì giờ ta dùng chung
  const sectionTitles = contentScroll.querySelectorAll(".section-title");
  sectionTitles.forEach(t => {
    if (t.textContent.includes("THƯ MỤC") || t.textContent.includes("TỆP TIN")) {
      t.style.display = "block";
    }
  });

  const gridFolders = contentScroll.querySelector(".grid-folders");
  if (gridFolders) gridFolders.style.display = "grid";
  const gridFiles = contentScroll.querySelector(".grid-files");
  if (gridFiles) {
    gridFiles.style.display = "";
    if (!gridFiles.classList.contains("list-view") && !contentScroll.classList.contains("list-view")) {
      gridFiles.style.display = "grid";
    } else {
      gridFiles.style.display = "flex";
    }
  }

  renderFolders(sharedFolders, "shared");
  renderFiles(sharedFiles, "shared");
}

/**
 * Hàm mẫu để gọi API lấy dữ liệu từ Backend
 * Gọi hàm này khi trang vừa load hoặc khi chuyển đổi giữa tab "Trang chủ" / "Tệp của tôi" / "Được chia sẻ"
 */
async function loadDashboardData(viewType = "home") {
  window.currentViewType = viewType; // Lưu trạng thái
  if (window.currentFolderId === undefined) {
    window.currentFolderId = null;
  }
  if (!window.folderPathTrail) {
    const rootName = viewType === "shared" ? "Được chia sẻ" :
      viewType === "trash" ? "Thùng rác" :
        viewType === "recent" ? "Gần đây" : "Tệp của tôi";
    window.folderPathTrail = [{ id: null, name: rootName }];
  }

  updateBreadcrumbUI();

  // Reset UI elements when switching away from shared view
  const contentScroll = document.querySelector(".content-scroll");
  if (contentScroll) {
    const heroBanner = contentScroll.querySelector(".shared-hero-banner");
    if (heroBanner) heroBanner.style.display = viewType === "shared" ? "flex" : "none";

    const trashContainer = document.getElementById("trash-view-container");
    if (trashContainer) trashContainer.style.display = viewType === "trash" ? "block" : "none";

    const settingsContainer = document.getElementById("settings-view-container");
    if (settingsContainer) settingsContainer.style.display = viewType === "settings" ? "block" : "none";

    // Xóa tiêu đề chia sẻ động để không bị lặp 2 chữ THƯ MỤC / TỆP TIN
    const sharedTitles = contentScroll.querySelectorAll(".shared-folder-title, .shared-file-title");
    sharedTitles.forEach(t => t.remove());

    const sectionTitles = contentScroll.querySelectorAll(".section-title");
    sectionTitles.forEach(t => t.style.display = (viewType === "trash" || viewType === "settings") ? "none" : "block");

    const gridFolders = contentScroll.querySelector(".grid-folders");
    if (gridFolders) gridFolders.style.display = (viewType === "trash" || viewType === "settings") ? "none" : "grid";

    const gridFiles = contentScroll.querySelector(".grid-files");
    if (gridFiles) {
      gridFiles.style.display = (viewType === "trash" || viewType === "settings") ? "none" : "";
      gridFiles.className = "grid-files";
    }
  }

  if (viewType === "shared") {
    try {
      const response = await fetchWithAuth("/shares/shared-with-me");
      if (response && response.ok) {
        const data = await response.json();
        renderSharedView(data);
        return;
      }
    } catch (err) {
      console.warn("Lỗi khi lấy dữ liệu chia sẻ:", err.message);
    }
    renderSharedView([]);
    return;
  }

  if (viewType === "settings") {
    if (typeof renderSettingsView === "function") {
      renderSettingsView();
    }
    return;
  }

  try {
    let endpoint = "/folders/root";
    if (window.currentFolderId) {
      endpoint = "/folders/" + window.currentFolderId + "/contents";
    } else if (viewType === "trash") {
      endpoint = "/trash";
    }

    // Gọi API lấy dữ liệu thực tế
    const response = await fetchWithAuth(endpoint);

    if (response && response.ok) {
      const data = await response.json();
      window.currentLoadedData = data;
      if (viewType === "trash") {
        renderTrashItems(data.folders || [], data.files || []);
      } else {
        let folders = data.subfolders || data.folders || [];
        let files = data.files || [];
        
        // Nếu đang ở "Tệp của tôi", lọc bỏ những file được người khác chia sẻ (permission khác OWNER)
        if (viewType === "home") {
          folders = folders.filter(f => !f.permission || f.permission === "OWNER");
          files = files.filter(f => !f.permission || f.permission === "OWNER");
        }
        
        renderFolders(folders);
        renderFiles(files);
      }
      return;
    }
  } catch (error) {
    console.warn("Lỗi khi lấy dữ liệu từ Backend API:", error.message);
  }

  // Nếu gặp lỗi API hoặc dữ liệu trống, render danh sách rỗng từ CSDDL (không nảy dữ liệu giả mockData)
  // Nếu gặp lỗi API hoặc dữ liệu trống, render danh sách rỗng từ CSDDL (không nảy dữ liệu giả mockData)
  if (viewType === "trash") {
    renderTrashItems([], []);
  } else {
    renderFolders([]);
    renderFiles([]);
  }
}

// -------------------------------------------------------------
// TRASH UI & ACTIONS
// -------------------------------------------------------------
function getFileIconForTrash(fileName) {
  if (!fileName) return '<i class="ph ph-file file-doc"></i>';
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return '<i class="ph ph-file-pdf file-pdf"></i>';
    case 'png': case 'jpg': case 'jpeg': case 'gif': return '<i class="ph ph-image file-img"></i>';
    case 'doc': case 'docx': return '<i class="ph ph-file-text file-doc"></i>';
    case 'xls': case 'xlsx': return '<i class="ph ph-file-xls file-xls"></i>';
    case 'mp4': case 'mov': case 'avi': return '<i class="ph ph-file-video file-mp4"></i>';
    case 'zip': case 'rar': case '7z': return '<i class="ph ph-file-zip file-zip"></i>';
    default: return '<i class="ph ph-file file-doc"></i>';
  }
}

function renderTrashItems(folders, files) {
  const container = document.getElementById("trash-view-container");
  const trashHeader = document.getElementById("trash-header-info");
  const trashList = document.getElementById("trash-list");
  const emptyState = document.getElementById("trash-empty-state");

  if (!container || !trashHeader || !trashList || !emptyState) return;

  const totalItems = folders.length + files.length;

  if (totalItems === 0) {
    trashHeader.style.display = "none";
    trashList.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }

  trashHeader.style.display = "block";
  trashList.style.display = "block";
  emptyState.style.display = "none";

  trashHeader.innerHTML = `${totalItems} mục &middot; Tự động xóa sau 30 ngày`;

  let html = '';

  const calculateDaysLeft = (dateString) => {
    if (!dateString) return 30;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diffDays);
  };

  const formatTrashDate = (dateString) => {
    if (!dateString) return "Không rõ";
    const date = parseLocalDate(dateString);
    if (!date) return String(dateString);
    const now = new Date();
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    // Kiểm tra xem có phải hôm nay không
    if (now.getDate() === date.getDate() && now.getMonth() === date.getMonth() && now.getFullYear() === date.getFullYear()) {
      return `Hôm nay, ${timeString}`;
    }
    
    // Kiểm tra xem có phải hôm qua không
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.getDate() === date.getDate() && yesterday.getMonth() === date.getMonth() && yesterday.getFullYear() === date.getFullYear()) {
      return `Hôm qua, ${timeString}`;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  // Render Folders
  folders.forEach(folder => {
    const daysLeft = calculateDaysLeft(folder.updatedAt); 
    const isUrgent = daysLeft <= 15 ? 'urgent' : '';
    const formattedDate = formatTrashDate(folder.updatedAt);
    const user = folder.userEmail ? folder.userEmail.split('@')[0] : 'Tôi';

    html += `
      <div class="trash-item">
        <div class="trash-checkbox" onclick="toggleTrashSelection(this)"></div>
        <div class="trash-icon-box">
          <i class="ph ph-folder" style="color: #64748b;"></i>
        </div>
        <div class="trash-item-info">
          <div class="trash-item-name">${folder.name}</div>
          <div class="trash-item-meta">
            Xóa lúc ${formattedDate} &middot; bởi ${user}
          </div>
        </div>
        <div class="trash-actions">
          <span class="days-left ${isUrgent}">Còn ~${daysLeft} ngày</span>
          <button class="btn-restore" onclick="restoreTrashItem(${folder.id}, 'folder')">Khôi phục</button>
          <button class="btn-delete" onclick="permanentDeleteTrashItem(${folder.id}, 'folder')">Xóa</button>
        </div>
      </div>
    `;
  });

  // Render Files
  files.forEach(file => {
    const daysLeft = calculateDaysLeft(file.updatedAt); 
    const isUrgent = daysLeft <= 15 ? 'urgent' : '';
    const size = typeof formatSizeGlobal === "function" ? formatSizeGlobal(file.sizeBytes) : file.sizeBytes;
    const fileName = file.fileName || "Tệp không tên";
    const formattedDate = formatTrashDate(file.updatedAt);
    const user = file.userEmail ? file.userEmail.split('@')[0] : 'Tôi';

    html += `
      <div class="trash-item">
        <div class="trash-checkbox" onclick="toggleTrashSelection(this)"></div>
        <div class="trash-icon-box">
          ${getFileIconForTrash(fileName)}
        </div>
        <div class="trash-item-info">
          <div class="trash-item-name">${fileName}</div>
          <div class="trash-item-meta">
            Xóa lúc ${formattedDate} &middot; bởi ${user} &middot; ${size}
          </div>
        </div>
        <div class="trash-actions">
          <span class="days-left ${isUrgent}">Còn ~${daysLeft} ngày</span>
          <button class="btn-restore" onclick="restoreTrashItem(${file.id}, 'file')">Khôi phục</button>
          <button class="btn-delete" onclick="permanentDeleteTrashItem(${file.id}, 'file')">Xóa</button>
        </div>
      </div>
    `;
  });

  trashList.innerHTML = html;
}

window.toggleTrashSelection = function(el) {
  el.classList.toggle('selected');
};

window.restoreTrashItem = async function(id, type) {
  try {
    const endpoint = type === 'folder' ? `/folders/${id}/restore` : `/files/${id}/restore`;
    const response = await fetchWithAuth(endpoint, { method: "PATCH" });
    if (response && response.ok) {
      // Reload trash data
      loadDashboardData("trash");
    } else {
      alert("Lỗi khôi phục mục!");
    }
  } catch (error) {
    console.error(error);
  }
};

window.permanentDeleteTrashItem = async function(id, type) {
  if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn mục này không? Thao tác không thể hoàn tác!")) return;
  try {
    const endpoint = type === 'folder' ? `/folders/${id}/permanent` : `/files/${id}/permanent`;
    const response = await fetchWithAuth(endpoint, { method: "DELETE" });
    if (response && response.ok) {
      // Reload trash data
      loadDashboardData("trash");
      // Update storage info if available
      if (typeof fetchStorageInfo === "function") fetchStorageInfo();
    } else {
      alert("Lỗi xóa vĩnh viễn!");
    }
  } catch (error) {
    console.error(error);
  }
};
