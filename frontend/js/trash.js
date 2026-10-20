// frontend/js/trash.js

// -------------------------------------------------------------
// TRASH UI & ACTIONS
// -------------------------------------------------------------

function getFileIconForTrash(fileName) {
  if (!fileName) return '<i class="ph ph-file file-default"></i>';
  if (typeof getFileCategoryAndIcon === "function") {
    const { iconClass, colorClass } = getFileCategoryAndIcon(fileName);
    return `<i class="ph ${iconClass} ${colorClass}"></i>`;
  }
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return '<i class="ph ph-file-pdf file-pdf"></i>';
    case 'png': case 'jpg': case 'jpeg': case 'gif': return '<i class="ph ph-file-image file-img"></i>';
    case 'doc': case 'docx': return '<i class="ph ph-file-doc file-doc"></i>';
    case 'txt': return '<i class="ph ph-file-txt file-txt"></i>';
    case 'xls': case 'xlsx': return '<i class="ph ph-file-xls file-xls"></i>';
    case 'ppt': case 'pptx': return '<i class="ph ph-file-ppt file-ppt"></i>';
    case 'mp4': case 'mov': case 'avi': return '<i class="ph ph-file-video file-vid"></i>';
    case 'zip': case 'rar': case '7z': return '<i class="ph ph-file-zip file-zip"></i>';
    default: return '<i class="ph ph-file file-default"></i>';
  }
}

window.renderTrashItems = function(folders, files) {
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
  trashList.style.display = "";
  emptyState.style.display = "none";

  trashHeader.innerHTML = `${totalItems} mục &middot; Tự động xóa sau 30 ngày`;

  trashList.innerHTML = '';

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
    const date = new Date(dateString);
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

  const folderTemplate = document.getElementById('trash-folder-template');
  const fileTemplate = document.getElementById('trash-file-template');

  // Render Folders
  folders.forEach(folder => {
    const daysLeft = calculateDaysLeft(folder.updatedAt); 
    const isUrgent = daysLeft <= 15 ? 'urgent' : '';
    const formattedDate = formatTrashDate(folder.updatedAt);
    const user = folder.userEmail ? folder.userEmail.split('@')[0] : 'Tôi';

    if (folderTemplate) {
      const clone = folderTemplate.content.cloneNode(true);
      const iconBox = clone.querySelector('.trash-icon-box');
      if (iconBox) {
        iconBox.className = 'trash-icon-box blue';
        iconBox.innerHTML = '<i class="ph-fill ph-folder"></i>';
      }
      clone.querySelector('.trash-item-name').textContent = folder.name;
      clone.querySelector('.trash-item-meta').innerHTML = `Xóa lúc ${formattedDate} &middot; bởi ${user}`;
      
      const daysLeftEl = clone.querySelector('.days-left');
      daysLeftEl.textContent = `Còn ~${daysLeft} ngày`;
      if (isUrgent) daysLeftEl.classList.add('urgent');
      
      clone.querySelector('.btn-restore').onclick = () => restoreTrashItem(folder.id, 'folder');
      clone.querySelector('.btn-delete').onclick = () => permanentDeleteTrashItem(folder.id, 'folder');
      
      trashList.appendChild(clone);
    }
  });

  // Render Files
  files.forEach(file => {
    const daysLeft = calculateDaysLeft(file.updatedAt); 
    const isUrgent = daysLeft <= 15 ? 'urgent' : '';
    const size = typeof formatSizeGlobal === "function" ? formatSizeGlobal(file.sizeBytes) : file.sizeBytes;
    const fileName = file.fileName || file.originalName || "Tệp không tên";
    const formattedDate = formatTrashDate(file.updatedAt);
    const user = file.userEmail ? file.userEmail.split('@')[0] : 'Tôi';
    const { iconClass, colorClass } = (typeof getFileCategoryAndIcon === "function") 
      ? getFileCategoryAndIcon(fileName) 
      : { iconClass: "ph-file", colorClass: "file-default" };

    if (fileTemplate) {
      const clone = fileTemplate.content.cloneNode(true);
      const iconBox = clone.querySelector('.trash-icon-box');
      if (iconBox) {
        iconBox.className = `trash-icon-box ${colorClass}`;
        iconBox.innerHTML = `<i class="ph ${iconClass}"></i>`;
      }
      clone.querySelector('.trash-item-name').textContent = fileName;
      clone.querySelector('.trash-item-meta').innerHTML = `Xóa lúc ${formattedDate} &middot; bởi ${user} &middot; ${size}`;
      
      const daysLeftEl = clone.querySelector('.days-left');
      daysLeftEl.textContent = `Còn ~${daysLeft} ngày`;
      if (isUrgent) daysLeftEl.classList.add('urgent');
      
      clone.querySelector('.btn-restore').onclick = () => restoreTrashItem(file.id, 'file');
      clone.querySelector('.btn-delete').onclick = () => permanentDeleteTrashItem(file.id, 'file');
      
      trashList.appendChild(clone);
    }
  });
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
      if (typeof loadDashboardData === "function") loadDashboardData("trash");
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
      if (typeof loadDashboardData === "function") loadDashboardData("trash");
      // Update storage info if available
      if (typeof window.renderStorageInfo === "function") window.renderStorageInfo();
    } else {
      alert("Lỗi xóa mục!");
    }
  } catch (error) {
    console.error(error);
  }
};
