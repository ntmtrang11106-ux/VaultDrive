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

    // 1. Tự động tìm tên tệp tin từ dữ liệu đã nạp nếu chưa có tham số name
    let finalFileName = name;
    if (!finalFileName && type === 'file') {
      const allFiles = [
        ...(window.currentLoadedData?.files || []),
        ...(window.lastSharedData?.files || []),
        ...(Array.isArray(window.lastSharedData) ? window.lastSharedData : []),
        ...(window.mockData?.files || [])
      ];
      const found = allFiles.find(item => (item.fileId || item.id) == id);
      if (found) {
        finalFileName = found.fileName || found.name || found.originalName;
      }
    } else if (!finalFileName && type === 'folder') {
      const allFolders = [
        ...(window.currentLoadedData?.folders || []),
        ...(window.currentLoadedData?.subfolders || []),
        ...(window.mockData?.folders || [])
      ];
      const found = allFolders.find(item => (item.folderId || item.id) == id);
      if (found) {
        finalFileName = (found.folderName || found.name || `folder_${id}`) + ".zip";
      }
    }

    // 2. Nếu vẫn chưa có, phân tích từ header Content-Disposition của máy chủ
    if (!finalFileName) {
      const disposition = response.headers.get("content-disposition") || "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        finalFileName = decodeURIComponent(utf8Match[1]);
      } else {
        const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
        if (asciiMatch && asciiMatch[1]) {
          finalFileName = asciiMatch[1];
        }
      }
    }

    // 3. Fallback cuối cùng nếu hoàn toàn không xác định được tên
    if (!finalFileName) {
      finalFileName = type === 'folder' ? `folder_${id}.zip` : `file_${id}`;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalFileName;
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

// ================================================================
// FILE PREVIEW SUBSYSTEM (Xem trước tệp tin đa định dạng)
// ================================================================

let currentPreviewBlobUrl = null;
let currentPreviewZoom = 1;
let currentPreviewRotation = 0;

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFileCategoryAndIcon(fileName) {
  const ext = (fileName || "").split(".").pop().toLowerCase();
  let iconClass = "ph-file";
  let colorClass = "file-default";

  if (["pdf"].includes(ext)) {
    iconClass = "ph-file-pdf";
    colorClass = "file-pdf";
  } else if (["doc", "docx", "rtf", "odt"].includes(ext)) {
    iconClass = "ph-file-doc";
    colorClass = "file-doc";
  } else if (["txt", "log", "ini", "env"].includes(ext)) {
    iconClass = "ph-file-txt";
    colorClass = "file-txt";
  } else if (["xls", "xlsx", "ods"].includes(ext)) {
    iconClass = "ph-file-xls";
    colorClass = "file-xls";
  } else if (["csv"].includes(ext)) {
    iconClass = "ph-file-csv";
    colorClass = "file-xls";
  } else if (["ppt", "pptx", "odp"].includes(ext)) {
    iconClass = "ph-file-ppt";
    colorClass = "file-ppt";
  } else if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "tiff"].includes(ext)) {
    iconClass = "ph-file-image";
    colorClass = "file-img";
  } else if (["mp4", "avi", "mov", "webm", "mkv", "flv", "wmv"].includes(ext)) {
    iconClass = "ph-file-video";
    colorClass = "file-vid";
  } else if (["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"].includes(ext)) {
    iconClass = "ph-file-audio";
    colorClass = "file-audio";
  } else if (["zip", "rar", "tar", "gz", "7z", "bz2", "xz", "iso"].includes(ext)) {
    iconClass = "ph-file-zip";
    colorClass = "file-zip";
  } else if (["md"].includes(ext)) {
    iconClass = "ph-file-md";
    colorClass = "file-md";
  } else if (["html", "htm"].includes(ext)) {
    iconClass = "ph-file-html";
    colorClass = "file-code";
  } else if (["css", "scss", "sass", "less"].includes(ext)) {
    iconClass = "ph-file-css";
    colorClass = "file-code";
  } else if (["js", "jsx", "mjs"].includes(ext)) {
    iconClass = "ph-file-js";
    colorClass = "file-code";
  } else if (["ts", "tsx"].includes(ext)) {
    iconClass = "ph-file-ts";
    colorClass = "file-code";
  } else if (["py"].includes(ext)) {
    iconClass = "ph-file-py";
    colorClass = "file-code";
  } else if (["sql"].includes(ext)) {
    iconClass = "ph-file-sql";
    colorClass = "file-code";
  } else if (["c", "h"].includes(ext)) {
    iconClass = "ph-file-c";
    colorClass = "file-code";
  } else if (["cpp", "hpp", "cc"].includes(ext)) {
    iconClass = "ph-file-cpp";
    colorClass = "file-code";
  } else if (["cs"].includes(ext)) {
    iconClass = "ph-file-c-sharp";
    colorClass = "file-code";
  } else if (["rs"].includes(ext)) {
    iconClass = "ph-file-rs";
    colorClass = "file-code";
  } else if (["json", "xml", "yaml", "yml", "php", "java", "sh", "bat"].includes(ext)) {
    iconClass = "ph-file-code";
    colorClass = "file-code";
  }

  return { ext, iconClass, colorClass };
}
window.getFileCategoryAndIcon = getFileCategoryAndIcon;

function closeFilePreview() {
  const params = new URLSearchParams(window.location.search);
  const isPreviewOnly = !!(params.get("token") || params.get("shareToken") || params.get("fileId") || params.get("previewFileId")) ||
    document.documentElement.classList.contains("preview-only-mode");

  // Nếu người dùng mở bằng link trong tab riêng: khi bấm dấu X thì trong tab đó KHÔNG chuyển lại giao diện dashboard
  if (isPreviewOnly) {
    if (currentPreviewBlobUrl) {
      URL.revokeObjectURL(currentPreviewBlobUrl);
      currentPreviewBlobUrl = null;
    }
    try {
      window.close();
    } catch (e) { }

    // Nếu trình duyệt chặn window.close() (do gõ/dán link trực tiếp): giữ nguyên màn hình tối và hiện thông báo đã đóng sạch sẽ
    const container = document.getElementById("previewModalContainer");
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-family: 'Inter', sans-serif; text-align: center; padding: 24px;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(16, 185, 129, 0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <i class="ph-bold ph-check" style="font-size: 28px; color: #10b981;"></i>
          </div>
          <h3 style="color: #f1f5f9; margin-bottom: 8px; font-size: 20px; font-weight: 600;">Đã đóng bản xem trước</h3>
          <p style="font-size: 14px; max-width: 340px; line-height: 1.6; color: #64748b; margin: 0;">Bạn có thể đóng tab trình duyệt này.</p>
        </div>
      `;
    }
    return;
  }

  const overlay = document.getElementById("previewModalOverlay");
  if (overlay) {
    overlay.style.display = "none";
  }
  document.body.classList.remove("modal-open");
  if (currentPreviewBlobUrl) {
    URL.revokeObjectURL(currentPreviewBlobUrl);
    currentPreviewBlobUrl = null;
  }
  const bodyEl = document.getElementById("previewModalBody");
  if (bodyEl) {
    bodyEl.innerHTML = "";
  }
  // Xóa param ?token= hoặc ?fileId= trên thanh địa chỉ URL nếu có
  if (window.location.search) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}
window.closeFilePreview = closeFilePreview;

function cloneTemplate(templateId) {
  const tmpl = document.getElementById(templateId);
  if (!tmpl) return null;
  return tmpl.content.cloneNode(true);
}

function renderPreviewError(container, message, fileId, fileName) {
  const fragment = cloneTemplate("tmpl-preview-error");
  if (!fragment) {
    container.innerHTML = `
      <div class="preview-media-wrapper preview-error-wrapper">
        <div class="preview-error-card">
          <i class="ph-bold ph-warning-circle preview-error-icon"></i>
          <h4>Không thể tải bản xem trước</h4>
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    `;
    return;
  }

  const msgEl = fragment.querySelector(".preview-error-msg");
  if (msgEl) msgEl.textContent = message || "Đã xảy ra sự cố khi tải bản xem trước.";

  const retryBtn = fragment.querySelector(".preview-retry-btn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => window.openFilePreview(fileId));
  }

  const dlBtn = fragment.querySelector(".preview-download-fallback-btn");
  if (dlBtn) {
    dlBtn.addEventListener("click", () => {
      if (typeof downloadItem === "function") {
        downloadItem(fileId, "file", fileName);
      }
    });
  }

  container.innerHTML = "";
  container.appendChild(fragment);
}

function renderImagePreview(container, url, fileName) {
  currentPreviewZoom = 1;
  currentPreviewRotation = 0;

  const fragment = cloneTemplate("tmpl-preview-image");
  if (!fragment) {
    console.error("Không tìm thấy template #tmpl-preview-image");
    return;
  }

  const imgEl = fragment.querySelector("#previewImageEl");
  const zoomValEl = fragment.querySelector("#previewZoomVal");
  const zoomInBtn = fragment.querySelector("#previewZoomIn");
  const zoomOutBtn = fragment.querySelector("#previewZoomOut");
  const rotateBtn = fragment.querySelector("#previewRotate");
  const scrollArea = fragment.querySelector("#previewImgScrollArea");

  if (imgEl) {
    imgEl.src = url;
    imgEl.alt = fileName || "Ảnh xem trước";
    imgEl.onerror = () => {
      renderPreviewError(container, "Không thể giải mã dữ liệu hình ảnh.", null, fileName);
    };
  }

  const updateTransform = () => {
    if (!imgEl) return;
    imgEl.style.transform = `scale(${currentPreviewZoom}) rotate(${currentPreviewRotation}deg)`;
    if (zoomValEl) zoomValEl.textContent = `${Math.round(currentPreviewZoom * 100)}%`;
  };

  zoomInBtn?.addEventListener("click", () => {
    if (currentPreviewZoom < 3.0) {
      currentPreviewZoom = Math.min(3.0, currentPreviewZoom + 0.25);
      updateTransform();
    }
  });

  zoomOutBtn?.addEventListener("click", () => {
    if (currentPreviewZoom > 0.3) {
      currentPreviewZoom = Math.max(0.3, currentPreviewZoom - 0.25);
      updateTransform();
    }
  });

  zoomValEl?.addEventListener("click", () => {
    currentPreviewZoom = 1;
    currentPreviewRotation = 0;
    updateTransform();
  });

  rotateBtn?.addEventListener("click", () => {
    currentPreviewRotation = (currentPreviewRotation + 90) % 360;
    updateTransform();
  });

  // Cuộn chuột phóng to/thu nhỏ
  scrollArea?.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      if (currentPreviewZoom < 3.0) {
        currentPreviewZoom = Math.min(3.0, currentPreviewZoom + 0.15);
        updateTransform();
      }
    } else {
      if (currentPreviewZoom > 0.3) {
        currentPreviewZoom = Math.max(0.3, currentPreviewZoom - 0.15);
        updateTransform();
      }
    }
  }, { passive: false });

  // Kéo rê ảnh khi zoom lớn
  let isDragging = false;
  let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;
  if (scrollArea) {
    scrollArea.addEventListener("mousedown", (e) => {
      if (currentPreviewZoom > 1.0) {
        isDragging = true;
        scrollArea.classList.add("is-dragging");
        startX = e.pageX - scrollArea.offsetLeft;
        startY = e.pageY - scrollArea.offsetTop;
        scrollLeft = scrollArea.scrollLeft;
        scrollTop = scrollArea.scrollTop;
      }
    });
    window.addEventListener("mouseup", () => {
      isDragging = false;
      scrollArea?.classList.remove("is-dragging");
    });
    scrollArea.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - scrollArea.offsetLeft;
      const y = e.pageY - scrollArea.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      scrollArea.scrollLeft = scrollLeft - walkX;
      scrollArea.scrollTop = scrollTop - walkY;
    });
  }

  container.innerHTML = "";
  container.appendChild(fragment);
}

function renderPdfPreview(container, url) {
  const fragment = cloneTemplate("tmpl-preview-pdf");
  if (!fragment) return;
  const iframe = fragment.querySelector(".preview-pdf-iframe");
  if (iframe) iframe.src = `${url}#toolbar=1`;
  container.innerHTML = "";
  container.appendChild(fragment);
}

function renderVideoPreview(container, url) {
  const fragment = cloneTemplate("tmpl-preview-video");
  if (!fragment) return;
  const video = fragment.querySelector("#previewVideoEl") || fragment.querySelector(".preview-video-player");
  if (video) video.src = url;

  // Điều khiển tốc độ phát video
  const speedBtns = fragment.querySelectorAll(".btn-vspeed");
  speedBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const speed = parseFloat(btn.dataset.speed || "1.0");
      if (video) video.playbackRate = speed;
      speedBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

function renderAudioPreview(container, url, fileName, sizeText) {
  const fragment = cloneTemplate("tmpl-preview-audio");
  if (!fragment) return;
  const titleEl = fragment.querySelector("#previewAudioTitle") || fragment.querySelector(".preview-audio-title");
  if (titleEl) titleEl.textContent = fileName || "Tệp âm thanh";
  const metaEl = fragment.querySelector("#previewAudioMeta") || fragment.querySelector(".preview-audio-meta");
  if (metaEl) metaEl.textContent = sizeText || "";
  const audio = fragment.querySelector("#previewAudioPlayer") || fragment.querySelector(".preview-audio-player");
  const card = fragment.querySelector("#previewAudioCard") || fragment.querySelector(".preview-audio-card");

  if (audio) {
    audio.src = url;
    audio.addEventListener("play", () => {
      card?.classList.add("playing");
    });
    audio.addEventListener("pause", () => {
      card?.classList.remove("playing");
    });
    audio.addEventListener("ended", () => {
      card?.classList.remove("playing");
    });
  }

  container.innerHTML = "";
  container.appendChild(fragment);
}

async function renderTextPreview(container, blob, ext, fileId = null, fileName = "") {
  try {
    let currentText = await blob.text();
    let initialText = currentText;
    const fragment = cloneTemplate("tmpl-preview-text");
    if (!fragment) return;

    const badge = fragment.querySelector("#previewTextBadge") || fragment.querySelector(".preview-text-badge");
    if (badge) badge.textContent = (ext || "TXT").toUpperCase();

    const statsEl = fragment.querySelector("#previewTextStats") || fragment.querySelector(".preview-text-stats");
    const dirtyBadge = fragment.querySelector("#previewTextDirty");
    const linesEl = fragment.querySelector("#previewCodeLines");
    const preEl = fragment.querySelector("#previewTextPre") || fragment.querySelector(".preview-text-pre");
    const codeEl = fragment.querySelector("#previewTextCode") || fragment.querySelector(".preview-text-code");
    const editorEl = fragment.querySelector("#previewTextEditor");
    const copyBtn = fragment.querySelector("#previewCopyCodeBtn");
    const toggleEditBtn = fragment.querySelector("#previewToggleEditBtn");
    const editModeText = fragment.querySelector("#previewEditModeText");
    const saveBtn = fragment.querySelector("#previewSaveCodeBtn");

    let isEditing = false;

    // Hàm cập nhật số dòng và số ký tự
    const updateStatsAndLines = (textVal) => {
      const lines = textVal.split("\n");
      if (statsEl) {
        statsEl.textContent = `${lines.length} dòng · ${textVal.length.toLocaleString('vi-VN')} ký tự`;
      }
      if (linesEl) {
        linesEl.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join("");
      }
    };

    // Khởi tạo hiển thị ban đầu
    if (codeEl) codeEl.textContent = currentText;
    if (editorEl) editorEl.value = currentText;
    updateStatsAndLines(currentText);

    // 1. Chức năng sao chép nội dung (Giữ nguyên trạng thái "Đã sao chép")
    let isCopied = false;
    const setCopiedStatus = (copied) => {
      isCopied = copied;
      if (!copyBtn) return;
      if (copied) {
        copyBtn.innerHTML = '<i class="ph-bold ph-check" style="color:#22c55e;"></i> <span style="color:#22c55e;">Đã sao chép</span>';
        copyBtn.classList.add("copied");
      } else {
        copyBtn.innerHTML = '<i class="ph-bold ph-copy"></i> <span>Sao chép</span>';
        copyBtn.classList.remove("copied");
      }
    };

    copyBtn?.addEventListener("click", () => {
      const textToCopy = isEditing && editorEl ? editorEl.value : (codeEl?.textContent || currentText);
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopiedStatus(true);
        })
        .catch(() => alert("Không thể tự động sao chép!"));
    });

    // 3. Chức năng chuyển đổi Chế độ Xem / Chỉnh sửa
    toggleEditBtn?.addEventListener("click", () => {
      isEditing = !isEditing;
      if (isEditing) {
        // Vào chế độ chỉnh sửa
        if (preEl) preEl.style.display = "none";
        if (editorEl) {
          editorEl.style.display = "block";
          editorEl.value = currentText;
          editorEl.focus();
        }
        if (saveBtn) saveBtn.style.display = "inline-flex";
        if (editModeText) editModeText.textContent = "Xem";
        toggleEditBtn.classList.add("active");
      } else {
        // Trở về chế độ xem
        if (preEl) preEl.style.display = "block";
        if (editorEl) editorEl.style.display = "none";
        if (saveBtn) saveBtn.style.display = "none";
        if (editModeText) editModeText.textContent = "Chỉnh sửa";
        toggleEditBtn.classList.remove("active");
        if (codeEl && editorEl) codeEl.textContent = editorEl.value;
      }
    });

    // 4. Lắng nghe gõ phím khi sửa nội dung
    if (editorEl) {
      editorEl.addEventListener("input", () => {
        const val = editorEl.value;
        updateStatsAndLines(val);
        // Khi người dùng gõ sửa văn bản mới, nút tự chuyển lại thành "Sao chép"
        if (isCopied) {
          setCopiedStatus(false);
        }
        // Hiển thị trạng thái chưa lưu nếu có thay đổi
        if (dirtyBadge) {
          dirtyBadge.style.display = (val !== initialText) ? "inline-block" : "none";
        }
      });

      // Hỗ trợ phím Tab thụt đầu dòng (2 dấu cách) và Ctrl + S để Lưu
      editorEl.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = editorEl.selectionStart;
          const end = editorEl.selectionEnd;
          editorEl.value = editorEl.value.substring(0, start) + "  " + editorEl.value.substring(end);
          editorEl.selectionStart = editorEl.selectionEnd = start + 2;
          updateStatsAndLines(editorEl.value);
          if (dirtyBadge) dirtyBadge.style.display = "inline-block";
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveContent();
        }
      });

      // Cuộn đồng bộ số dòng với nội dung text
      editorEl.addEventListener("scroll", () => {
        if (linesEl) linesEl.scrollTop = editorEl.scrollTop;
      });
    }

    if (preEl) {
      preEl.addEventListener("scroll", () => {
        if (linesEl) linesEl.scrollTop = preEl.scrollTop;
      });
    }

    // 5. Hàm lưu nội dung (Chuẩn bị sẵn để gọi API Backend PUT /api/files/{id}/content)
    async function saveContent() {
      if (!editorEl) return;
      const newText = editorEl.value;

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph-bold ph-spinner"></i> <span>Đang lưu...</span>';
      }

      try {
        if (!fileId) throw new Error("Không có fileId để lưu");

        // Gọi API Backend chuẩn bị sẵn: PUT /api/files/{id}/content
        const response = await fetchWithAuth(`/files/${fileId}/content`, {
          method: "PUT",
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          },
          body: newText
        });

        if (response && response.ok) {
          currentText = newText;
          initialText = newText;
          if (codeEl) codeEl.textContent = newText;
          if (dirtyBadge) dirtyBadge.style.display = "none";
          if (saveBtn) saveBtn.innerHTML = '<i class="ph-bold ph-check" style="color:#22c55e;"></i> <span style="color:#22c55e;">Đã lưu!</span>';
        } else {
          // Trường hợp Backend chưa có endpoint PUT /files/{id}/content
          currentText = newText;
          initialText = newText;
          if (codeEl) codeEl.textContent = newText;
          if (dirtyBadge) dirtyBadge.style.display = "none";
          if (saveBtn) saveBtn.innerHTML = '<i class="ph-bold ph-check" style="color:#38bdf8;"></i> <span style="color:#38bdf8;">Đã lưu tạm!</span>';
          console.info(`[Frontend] Đã chuẩn bị sẵn API PUT /api/files/${fileId}/content. Hiện tại Backend chưa triển khai nên nội dung được cập nhật trên giao diện.`);
        }
      } catch (err) {
        // Fallback lưu giao diện tạm thời khi chưa có Backend
        currentText = newText;
        initialText = newText;
        if (codeEl) codeEl.textContent = newText;
        if (dirtyBadge) dirtyBadge.style.display = "none";
        if (saveBtn) saveBtn.innerHTML = '<i class="ph-bold ph-check" style="color:#38bdf8;"></i> <span style="color:#38bdf8;">Đã lưu tạm!</span>';
      } finally {
        setTimeout(() => {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> <span>Lưu thay đổi</span>';
          }
        }, 2000);
      }
    }

    // Gắn sự kiện click cho nút Lưu
    saveBtn?.addEventListener("click", () => {
      saveContent();
    });

    container.innerHTML = "";
    container.appendChild(fragment);
  } catch (err) {
    console.error("Lỗi khi đọc file văn bản:", err);
    renderPreviewError(container, "Không thể đọc nội dung văn bản. Tệp tin có thể mã hóa theo định dạng nhị phân không tương thích.");
  }
}


function renderUnsupportedPreview(container, fileName, ext, sizeText, iconClass, colorClass, fileId) {
  const fragment = cloneTemplate("tmpl-preview-unsupported");
  if (!fragment) return;

  const dlBtn = fragment.querySelector("#previewUnsupportedDownloadBtn");
  dlBtn?.addEventListener("click", () => {
    if (typeof downloadItem === "function") {
      downloadItem(fileId, "file", fileName);
    }
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

async function openFilePreview(fileId, fileData = null) {
  if (!fileId) return;

  // Tìm thông tin file trong bộ nhớ đệm hoặc tham số
  let file = fileData;
  if (!file && window.currentLoadedData && window.currentLoadedData.files) {
    file = window.currentLoadedData.files.find(f => (f.fileId || f.id) == fileId);
  }
  if (!file && window.mockData && window.mockData.files) {
    file = window.mockData.files.find(f => (f.fileId || f.id) == fileId);
  }

  const fileName = file ? (file.fileName || file.name || file.originalName || `file_${fileId}`) : `file_${fileId}`;
  const fileSizeVal = file ? (file.sizeBytes !== undefined ? file.sizeBytes : file.size) : null;
  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const num = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return num.toString().replace(".", ",") + " " + sizes[i];
  };

  const formatShortDate = (dateVal) => {
    if (!dateVal) return "";
    try {
      const d = (typeof parseLocalDate === 'function') ? parseLocalDate(dateVal) : new Date(dateVal);
      if (!d || isNaN(d.getTime())) return "";
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `Chỉnh sửa ${dd}/${mm}`;
    } catch (_) {
      return "";
    }
  };

  const displaySize = fileSizeVal ? formatSize(fileSizeVal) : "";
  const dateText = file ? formatShortDate(file.updatedAt || file.createdAt) : "";
  const { ext, iconClass, colorClass } = getFileCategoryAndIcon(fileName);

  const buildMetaString = (sizeStr, dateStr, extStr) => {
    const parts = [];
    if (sizeStr) parts.push(sizeStr);
    if (dateStr) parts.push(dateStr);
    if (parts.length === 0) return `.${(extStr || "").toUpperCase()}`;
    return parts.join(" · ");
  };

  // Lấy các DOM phần tử
  const overlay = document.getElementById("previewModalOverlay");
  const fileNameEl = document.getElementById("previewFileName");
  const fileMetaEl = document.getElementById("previewFileMeta");
  const fileIconEl = document.getElementById("previewFileIcon");
  const fileIconInner = document.getElementById("previewFileIconInner");
  const bodyEl = document.getElementById("previewModalBody");
  const downloadBtn = document.getElementById("previewDownloadBtn");

  if (!overlay || !bodyEl) {
    console.error("Preview modal DOM element không tìm thấy!");
    return;
  }

  // Cập nhật Header
  if (fileNameEl) {
    fileNameEl.textContent = fileName;
    fileNameEl.title = fileName;
  }
  document.title = `${fileName} - VaultDrive`;
  if (fileMetaEl) {
    fileMetaEl.textContent = buildMetaString(displaySize, dateText, ext);
  }
  if (fileIconEl) {
    fileIconEl.className = `preview-file-icon ${colorClass}`;
  }
  if (fileIconInner) {
    fileIconInner.className = `ph-fill ${iconClass}`;
  }

  if (downloadBtn) {
    downloadBtn.onclick = () => {
      if (typeof downloadItem === "function") {
        downloadItem(fileId, 'file', fileName);
      }
    };
  }

  // Hủy blob URL cũ nếu có
  if (currentPreviewBlobUrl) {
    URL.revokeObjectURL(currentPreviewBlobUrl);
    currentPreviewBlobUrl = null;
  }

  // Danh sách các định dạng hỗ trợ và không hỗ trợ
  const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];
  const pdfExts = ["pdf"];
  const videoExts = ["mp4", "webm", "ogg", "mov"];
  const audioExts = ["mp3", "wav", "ogg", "m4a", "flac"];
  const textCodeExts = ["txt", "md", "json", "js", "ts", "html", "css", "py", "java", "c", "cpp", "cs", "php", "sql", "xml", "yaml", "yml", "sh", "bat", "log", "ini", "env"];
  const unsupportedExts = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "7z", "tar", "gz", "exe", "apk", "dmg", "iso", "bin"];

  const isImage = imageExts.includes(ext);
  const isPdf = pdfExts.includes(ext);
  const isVideo = videoExts.includes(ext);
  const isAudio = audioExts.includes(ext);
  const isTextOrCode = textCodeExts.includes(ext);
  const isKnownSupported = isImage || isPdf || isVideo || isAudio || isTextOrCode;
  const isKnownUnsupported = unsupportedExts.includes(ext);

  overlay.style.display = "flex";
  document.body.classList.add("modal-open");

  // 1. Nếu là định dạng KHÔNG THỂ XEM TRỰC TIẾP (Office: doc, docx, xls, xlsx, ppt, pptx; Nén: zip, rar...)
  // Hoặc định dạng lạ không hỗ trợ: hiển thị NGAY giao diện Chuẩn Hình 1 (không cần gọi fetch tốn băng thông)
  if (isKnownUnsupported || (!isKnownSupported && ext)) {
    renderUnsupportedPreview(bodyEl, fileName, ext, displaySize, iconClass, colorClass, fileId);
    return;
  }

  // 2. Với các tệp XEM ĐƯỢC: Hiển thị trạng thái đang tải từ template trong khi fetch
  const loadingFrag = cloneTemplate("tmpl-preview-loading");
  bodyEl.innerHTML = "";
  if (loadingFrag) {
    bodyEl.appendChild(loadingFrag);
  } else {
    bodyEl.innerHTML = `
      <div class="preview-loading">
        <div class="preview-spinner"></div>
        <p>Đang tải bản xem trước...</p>
      </div>
    `;
  }

  try {
    let objectUrl = file?.previewUrl || file?.url || null;
    let blob = null;

    if (!objectUrl) {
      const token = localStorage.getItem("jwt_token") || localStorage.getItem("token");
      const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "http://localhost:8080/api";
      const response = await fetch(`${baseUrl}/files/${fileId}/preview`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Máy chủ không thể cung cấp bản xem trước`);
      }

      // Trích xuất tên tệp từ header Content-Disposition nếu chưa có tên thật
      const disposition = response.headers.get("content-disposition") || "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
      const serverFileName = (utf8Match && utf8Match[1]) ? decodeURIComponent(utf8Match[1]) : (asciiMatch ? asciiMatch[1] : null);
      if (serverFileName && (!file || fileName.startsWith("file_"))) {
        fileName = serverFileName;
        const iconInfo = getFileCategoryAndIcon(serverFileName);
        ext = iconInfo.ext;
        if (fileNameEl) {
          fileNameEl.textContent = fileName;
          fileNameEl.title = fileName;
        }
        if (fileIconEl) fileIconEl.className = `preview-file-icon ${iconInfo.colorClass}`;
        if (fileIconInner) fileIconInner.className = `ph-fill ${iconInfo.iconClass}`;
        document.title = `${fileName} - VaultDrive`;
      }

      blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      currentPreviewBlobUrl = objectUrl;
    }

    if (fileMetaEl && blob && blob.size) {
      fileMetaEl.textContent = buildMetaString(formatSize(blob.size), dateText, ext);
    }

    const mimeType = blob ? (blob.type || "") : "";
    const finalIsImage = isImage || mimeType.startsWith("image/");
    const finalIsPdf = isPdf || mimeType === "application/pdf";
    const finalIsVideo = isVideo || mimeType.startsWith("video/");
    const finalIsAudio = isAudio || mimeType.startsWith("audio/");
    const finalIsTextOrCode = isTextOrCode || mimeType.startsWith("text/");

    if (finalIsImage) {
      // Hình ảnh (.png, .jpg, .jpeg, .gif, .svg, .webp, .bmp, .ico) — Chuẩn Hình 2
      renderImagePreview(bodyEl, objectUrl, fileName);
    } else if (finalIsPdf) {
      renderPdfPreview(bodyEl, objectUrl);
    } else if (finalIsVideo) {
      renderVideoPreview(bodyEl, objectUrl);
    } else if (finalIsAudio) {
      renderAudioPreview(bodyEl, objectUrl, fileName, displaySize || (blob ? formatSize(blob.size) : ""));
    } else if (finalIsTextOrCode) {
      if (blob) {
        await renderTextPreview(bodyEl, blob, ext, fileId, fileName);
      } else {
        const textRes = await fetch(objectUrl);
        const textBlob = await textRes.blob();
        await renderTextPreview(bodyEl, textBlob, ext, fileId, fileName);
      }
    } else {
      // Trường hợp dự phòng nếu mimeType thực tế không hỗ trợ xem
      renderUnsupportedPreview(bodyEl, fileName, ext, displaySize || (blob ? formatSize(blob.size) : ""), iconClass, colorClass, fileId);
    }

  } catch (err) {
    console.error("Lỗi khi mở bản xem trước:", err);
    // Nếu tệp thuộc nhóm xem được (như JPG/PNG) nhưng tải bị lỗi (lỗi mạng hoặc file không tồn tại trên ổ đĩa),
    // hiển thị giao diện báo lỗi kèm nút Thử lại / Tải về máy
    renderPreviewError(bodyEl, "Không thể tải bản xem trước của tệp tin. Vui lòng kiểm tra kết nối mạng hoặc thử tải tệp về máy.", fileId, fileName);
  }
}
window.openFilePreview = openFilePreview;

/**
 * Xem trước file công khai qua token chia sẻ (/api/public/share-links/{token})
 * Tái sử dụng toàn bộ code preview cũ (renderImagePreview, renderPdfPreview, renderTextPreview, renderUnsupportedPreview...)
 */
async function openPublicFilePreview(token) {
  if (!token) return;

  const overlay = document.getElementById("previewModalOverlay");
  const fileNameEl = document.getElementById("previewFileName");
  const fileMetaEl = document.getElementById("previewFileMeta");
  const fileIconEl = document.getElementById("previewFileIcon");
  const fileIconInner = document.getElementById("previewFileIconInner");
  const bodyEl = document.getElementById("previewModalBody");
  const downloadBtn = document.getElementById("previewDownloadBtn");

  if (!overlay || !bodyEl) {
    console.error("Preview modal DOM element không tìm thấy!");
    return;
  }

  overlay.style.display = "flex";
  document.body.classList.add("modal-open");

  // Hiển thị trạng thái đang tải
  const loadingFrag = cloneTemplate("tmpl-preview-loading");
  bodyEl.innerHTML = "";
  if (loadingFrag) {
    bodyEl.appendChild(loadingFrag);
  } else {
    bodyEl.innerHTML = `
      <div class="preview-loading">
        <div class="preview-spinner"></div>
        <p>Đang tải bản xem trước...</p>
      </div>
    `;
  }

  try {
    const baseUrl = typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://localhost:8080/api";
    const res = await fetch(`${baseUrl}/public/share-links/${token}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Liên kết chia sẻ không tồn tại hoặc đã hết hạn!");
    }

    const data = await res.json();
    if (data.type !== "FILE" || !data.file) {
      if (data.type === "FOLDER") {
        window.location.href = `dashboard.html?token=${encodeURIComponent(token)}`;
        return;
      }
      throw new Error("Liên kết chia sẻ không trỏ đến một tệp tin xem trước được!");
    }

    const file = data.file;
    const fileId = file.fileId || file.id;
    const fileName = file.fileName || "Tệp chia sẻ";
    const fileSizeVal = file.sizeBytes;

    const formatSize = (bytes) => {
      if (!bytes && bytes !== 0) return "";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      const num = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
      return num.toString().replace(".", ",") + " " + sizes[i];
    };

    const formatShortDate = (dateVal) => {
      if (!dateVal) return "";
      try {
        const d = typeof parseLocalDate === "function" ? parseLocalDate(dateVal) : new Date(dateVal);
        if (!d || isNaN(d.getTime())) return "";
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return `Chỉnh sửa ${dd}/${mm}`;
      } catch (_) {
        return "";
      }
    };

    const displaySize = fileSizeVal ? formatSize(fileSizeVal) : "";
    const dateText = file ? formatShortDate(file.updatedAt || file.createdAt) : "";
    const { ext, iconClass, colorClass } = getFileCategoryAndIcon(fileName);

    const buildMetaString = (sizeStr, dateStr, extStr) => {
      const parts = [];
      if (sizeStr) parts.push(sizeStr);
      if (dateStr) parts.push(dateStr);
      if (parts.length === 0) return `.${(extStr || "").toUpperCase()}`;
      return parts.join(" · ");
    };

    // Cập nhật Header
    if (fileNameEl) {
      fileNameEl.textContent = fileName;
      fileNameEl.title = fileName;
    }
    document.title = `${fileName} - VaultDrive`;
    if (fileMetaEl) {
      fileMetaEl.textContent = buildMetaString(displaySize, dateText, ext);
    }
    if (fileIconEl) {
      fileIconEl.className = `preview-file-icon ${colorClass}`;
    }
    if (fileIconInner) {
      fileIconInner.className = `ph-fill ${iconClass}`;
    }

    // Nút tải xuống công khai
    const publicDownloadUrl = `${baseUrl}/public/share-links/${token}/download`;
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        window.location.href = publicDownloadUrl;
      };
    }

    // Hủy blob URL cũ nếu có
    if (currentPreviewBlobUrl) {
      URL.revokeObjectURL(currentPreviewBlobUrl);
      currentPreviewBlobUrl = null;
    }

    // Danh sách các định dạng
    const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];
    const pdfExts = ["pdf"];
    const videoExts = ["mp4", "webm", "ogg", "mov"];
    const audioExts = ["mp3", "wav", "ogg", "m4a", "flac"];
    const textCodeExts = ["txt", "md", "json", "js", "ts", "html", "css", "py", "java", "c", "cpp", "cs", "php", "sql", "xml", "yaml", "yml", "sh", "bat", "log", "ini", "env"];
    const unsupportedExts = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "7z", "tar", "gz", "exe", "apk", "dmg", "iso", "bin"];

    const isImage = imageExts.includes(ext);
    const isPdf = pdfExts.includes(ext);
    const isVideo = videoExts.includes(ext);
    const isAudio = audioExts.includes(ext);
    const isTextOrCode = textCodeExts.includes(ext);
    const isKnownSupported = isImage || isPdf || isVideo || isAudio || isTextOrCode;
    const isKnownUnsupported = unsupportedExts.includes(ext);

    // 1. Định dạng không hỗ trợ xem trực tiếp (docx, xlsx, pptx, zip...) -> renderUnsupportedPreview (Hình 1)
    if (isKnownUnsupported || (!isKnownSupported && ext)) {
      renderUnsupportedPreview(bodyEl, fileName, ext, displaySize, iconClass, colorClass, fileId);
      const unsuppBtn = bodyEl.querySelector("#previewUnsupportedDownloadBtn");
      if (unsuppBtn) {
        unsuppBtn.onclick = () => {
          window.location.href = publicDownloadUrl;
        };
      }
      return;
    }

    // 2. Tải blob từ endpoint xem trước công khai
    const previewRes = await fetch(`${baseUrl}/public/share-links/${token}/preview`);
    if (!previewRes.ok) {
      throw new Error(`HTTP ${previewRes.status}: Máy chủ không thể cung cấp bản xem trước`);
    }

    const blob = await previewRes.blob();
    const objectUrl = URL.createObjectURL(blob);
    currentPreviewBlobUrl = objectUrl;

    if (fileMetaEl && blob && blob.size) {
      fileMetaEl.textContent = buildMetaString(formatSize(blob.size), dateText, ext);
    }

    const mimeType = blob ? (blob.type || "") : "";
    const finalIsImage = isImage || mimeType.startsWith("image/");
    const finalIsPdf = isPdf || mimeType === "application/pdf";
    const finalIsVideo = isVideo || mimeType.startsWith("video/");
    const finalIsAudio = isAudio || mimeType.startsWith("audio/");
    const finalIsTextOrCode = isTextOrCode || mimeType.startsWith("text/");

    if (finalIsImage) {
      renderImagePreview(bodyEl, objectUrl, fileName);
    } else if (finalIsPdf) {
      renderPdfPreview(bodyEl, objectUrl);
    } else if (finalIsVideo) {
      renderVideoPreview(bodyEl, objectUrl);
    } else if (finalIsAudio) {
      renderAudioPreview(bodyEl, objectUrl, fileName, displaySize || formatSize(blob.size));
    } else if (finalIsTextOrCode) {
      // Xem văn bản/mã nguồn (Hình 2: hiển thị cả Sao chép và Chỉnh sửa)
      await renderTextPreview(bodyEl, blob, ext, fileId, fileName);
    } else {
      renderUnsupportedPreview(bodyEl, fileName, ext, displaySize || formatSize(blob.size), iconClass, colorClass, fileId);
      const unsuppBtn = bodyEl.querySelector("#previewUnsupportedDownloadBtn");
      if (unsuppBtn) {
        unsuppBtn.onclick = () => {
          window.location.href = publicDownloadUrl;
        };
      }
    }

  } catch (err) {
    console.error("Lỗi khi mở bản xem trước công khai:", err);
    renderPreviewError(bodyEl, err.message || "Không thể tải bản xem trước của tệp tin.", null, "Tệp chia sẻ");
  }
}
window.openPublicFilePreview = openPublicFilePreview;

document.addEventListener("DOMContentLoaded", () => {
  // Lấy tham chiếu đến Context Menu và các Modal overlay
  const contextMenu = document.getElementById("globalContextMenu");  // Menu chuột phải

  // Nếu đang ở trang xem trước riêng biệt (preview.html) hoặc trang không có context menu
  if (!contextMenu) {
    const closePreviewBtn = document.getElementById("closePreviewModal");
    if (closePreviewBtn) {
      closePreviewBtn.addEventListener("click", closeFilePreview);
    }
    const previewOverlayEl = document.getElementById("previewModalOverlay");
    if (previewOverlayEl) {
      previewOverlayEl.addEventListener("click", (e) => {
        if (e.target === previewOverlayEl) {
          closeFilePreview();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeFilePreview();
      }
    });

    // Tự động mở xem trước nếu URL có param token hoặc fileId
    const pageParams = new URLSearchParams(window.location.search);
    const paramToken = pageParams.get("token") || pageParams.get("shareToken");
    const paramFileId = pageParams.get("fileId") || pageParams.get("previewFileId");

    if (paramToken && typeof openPublicFilePreview === "function") {
      openPublicFilePreview(paramToken);
    } else if (paramFileId && typeof openFilePreview === "function") {
      openFilePreview(paramFileId);
    }
    return;
  }

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
      if (contextMenu) contextMenu.style.display = "none";
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
    const ctxPreview = document.getElementById("ctxPreview");     // "Xem trước"

    if (ctxPreview) {
      if (type === 'file' && window.currentViewType !== "trash") {
        ctxPreview.style.display = "flex";
      } else {
        ctxPreview.style.display = "none";
      }
    }

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
    clearRenameError();

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

    // Lấy thông tin phụ trợ từ cache nếu có
    const allItems = [
      ...(window.currentLoadedData?.files || []),
      ...(window.currentLoadedData?.folders || []),
      ...(Array.isArray(window.lastSharedData) ? window.lastSharedData : [])
    ];
    const sharedMeta = allItems.find(i => (i.fileId || i.id) == itemId || (i.folderId || i.id) == itemId);

    try {
      const queryParam = itemType === 'file' ? `fileId=${itemId}` : `folderId=${itemId}`;
      const res = await fetchWithAuth(`/shares/users?${queryParam}`);

      let sharedUsers = [];
      if (res && res.ok) {
        sharedUsers = await res.json();
      } else {
        // Dự phòng nếu backend chưa mở quyền cho viewer xem API /shares/users
        sharedUsers = getFallbackSharedUsers(sharedMeta);
      }
      if (!Array.isArray(sharedUsers)) sharedUsers = [];

      // Tự động kiểm tra và bổ sung dòng Chủ sở hữu (OWNER) ở vị trí đầu tiên
      const hasOwnerInList = sharedUsers.some(s => s.permission === 'OWNER');
      if (!hasOwnerInList) {
        let ownerEmail = null;
        if (window.currentLoadedData) {
          const list = itemType === 'file' ? (window.currentLoadedData.files || []) : (window.currentLoadedData.subfolders || window.currentLoadedData.folders || []);
          const currentItem = list.find(i => (i.fileId || i.id) == itemId);
          if (currentItem && currentItem.userEmail) {
            ownerEmail = currentItem.userEmail;
          }
        }
        if (!ownerEmail && sharedUsers.length > 0 && sharedUsers[0].sharedByEmail) {
          ownerEmail = sharedUsers[0].sharedByEmail;
        }
        if (!ownerEmail && sharedMeta && (sharedMeta.sharedByEmail || sharedMeta.userEmail)) {
          ownerEmail = sharedMeta.sharedByEmail || sharedMeta.userEmail;
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

      const isCurrentOwner = !window.currentTargetPermission || window.currentTargetPermission === "OWNER";

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

        // Nếu người xem hiện tại không phải Owner thì chỉ xem quyền dạng text (không thể sửa quyền của người khác)
        if (!isCurrentOwner) {
          const roleText = perm === 'EDIT' ? 'Người chỉnh sửa' : 'Người xem';
          return `
            <div class="shared-user-item">
              <div class="shared-user-info">
                <div class="shared-user-avatar" style="background-color: #0ea5e9;">${initial}</div>
                <div class="shared-user-details">
                  <span class="su-name">${userEmail.split('@')[0]}</span>
                  <span class="su-email">${userEmail}</span>
                </div>
              </div>
              <span style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 12px;">${roleText}</span>
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
      const fallbackList = getFallbackSharedUsers(sharedMeta);
      container.innerHTML = fallbackList.map(share => {
        const userEmail = share.sharedToEmail || "User";
        const initial = userEmail.charAt(0).toUpperCase();
        const roleText = share.permission === 'OWNER' ? 'Chủ sở hữu' : (share.permission === 'EDIT' ? 'Người chỉnh sửa' : 'Người xem');
        return `
          <div class="shared-user-item">
            <div class="shared-user-info">
              <div class="shared-user-avatar" style="background-color: #0ea5e9;">${initial}</div>
              <div class="shared-user-details">
                <span class="su-name">${userEmail.split('@')[0]}</span>
                <span class="su-email">${userEmail}</span>
              </div>
            </div>
            <span style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 12px;">${roleText}</span>
          </div>
        `;
      }).join('');
    }
  }

  function getFallbackSharedUsers(sharedMeta) {
    const list = [];
    const ownerEmail = sharedMeta?.sharedByEmail || sharedMeta?.userEmail;
    if (ownerEmail) {
      list.push({ id: -1, sharedToEmail: ownerEmail, permission: 'OWNER' });
    }
    const myEmail = sharedMeta?.sharedToEmail || localStorage.getItem("user_email");
    if (myEmail && myEmail !== ownerEmail) {
      list.push({ id: -2, sharedToEmail: myEmail, permission: sharedMeta?.permission || window.currentTargetPermission || 'VIEW' });
    }
    return list;
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

    const shareInputGroup = document.querySelector(".share-input-group");
    const shareRoleSelect = document.getElementById("shareRoleSelect");
    const addShareUserBtn = document.getElementById("addShareUserBtn");

    // Chế độ xem: nếu quyền là VIEWER / VIEW thì làm mờ khung nhập email
    const isViewer = window.currentTargetPermission === "VIEWER" || window.currentTargetPermission === "VIEW";

    if (shareInputGroup) {
      shareInputGroup.style.display = "flex";
      shareInputGroup.style.opacity = isViewer ? "0.55" : "1";
    }

    if (emailInput) {
      emailInput.disabled = isViewer;
      emailInput.placeholder = isViewer ? "Bạn chỉ có quyền xem" : "Thêm người bằng email...";
      emailInput.style.backgroundColor = isViewer ? "#f1f5f9" : "white";
    }
    if (shareRoleSelect) {
      shareRoleSelect.disabled = isViewer;
      shareRoleSelect.style.backgroundColor = isViewer ? "#f1f5f9" : "white";
    }
    if (addShareUserBtn) {
      addShareUserBtn.disabled = isViewer;
      addShareUserBtn.style.opacity = isViewer ? "0.5" : "1";
      addShareUserBtn.style.cursor = isViewer ? "not-allowed" : "pointer";
    }

    // Lấy thông tin từ backend
    await fetchSharedUsers(currentTargetId, currentTargetType);
    if (typeof initGeneralAccessModal === "function") {
      await initGeneralAccessModal(currentTargetId, currentTargetType);
    }
  });

  const ctxPreviewItem = document.getElementById("ctxPreview");
  if (ctxPreviewItem) {
    ctxPreviewItem.addEventListener("click", (e) => {
      e.preventDefault();
      contextMenu.style.display = "none";
      if (currentTargetId && currentTargetType === 'file') {
        openFilePreview(currentTargetId);
      }
    });
  }

  document.getElementById("ctxDownload")?.addEventListener("click", (e) => {
    e.preventDefault();
    contextMenu.style.display = "none";
    if (currentTargetId && currentTargetType) {
      let targetName = null;
      if (currentTargetType === 'file') {
        const list = window.currentLoadedData?.files || [];
        const f = list.find(item => (item.fileId || item.id) == currentTargetId);
        if (f) targetName = f.fileName || f.name || f.originalName;
      } else {
        const list = window.currentLoadedData?.folders || [];
        const f = list.find(item => (item.folderId || item.id) == currentTargetId);
        if (f) targetName = (f.folderName || f.name || `folder_${currentTargetId}`) + ".zip";
      }
      downloadItem(currentTargetId, currentTargetType, targetName);
    }
  });

  // Trạng thái quyền truy cập chung (General Access)
  let currentGeneralAccessMode = "RESTRICTED"; // 'RESTRICTED' | 'PUBLIC'
  let currentActiveShareLinkId = null;
  let currentShareUrl = null;
  let currentActiveToken = null;

  /**
   * Tạo đường dẫn liên kết xem trước tệp trực tiếp trên dashboard (mở ở tab mới)
   */
  function buildShareWebUrl(token, fileId, targetType = "file") {
    const href = window.location.href;
    const base = href.substring(0, href.lastIndexOf('/') + 1);
    if (token) {
      return `${base}dashboard.html?token=${encodeURIComponent(token)}`;
    }
    const idParam = targetType === "folder" ? "folderId" : "fileId";
    return `${base}dashboard.html?${idParam}=${encodeURIComponent(fileId)}`;
  }
  window.buildShareWebUrl = buildShareWebUrl;

  /**
   * Sao chép liên kết xem trước tệp qua Backend (/api/share-links) hoặc link nội bộ tùy theo chế độ truy cập chung
   */
  async function copyResourceShareLink(targetId, targetType, triggerBtn = null) {
    if (!targetId || !targetType) return;

    const originalHtml = triggerBtn ? triggerBtn.innerHTML : "";
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Đang lấy liên kết...';
    }

    try {
      let webShareUrl = null;

      // 1. Nếu đang mở modal chia sẻ và đang ở chế độ HẠN CHẾ
      if (triggerBtn && currentGeneralAccessMode === "RESTRICTED") {
        webShareUrl = buildShareWebUrl(null, targetId, targetType);
      } else {
        // Chế độ công khai hoặc gọi ngoài context menu
        let activeToken = currentActiveToken || (currentShareUrl ? currentShareUrl.split("/").pop() : null);

        if (!activeToken) {
          const queryParam = targetType === "file" ? `fileId=${targetId}` : `folderId=${targetId}`;

          // Kiểm tra xem file/folder đã có link chia sẻ công khai nào đang hoạt động chưa
          try {
            const checkRes = await fetchWithAuth(`/share-links?${queryParam}`);
            if (checkRes && checkRes.ok) {
              const links = await checkRes.json();
              if (Array.isArray(links) && links.length > 0) {
                const activeLink = links.find((l) => l.isActive !== false) || links[0];
                if (activeLink && activeLink.publicUrl) {
                  currentActiveShareLinkId = activeLink.id;
                  currentShareUrl = activeLink.publicUrl;
                  currentActiveToken = activeLink.token || activeLink.publicUrl.split("/").pop();
                  activeToken = currentActiveToken;
                }
              }
            }
          } catch (checkErr) {
            console.warn("Chưa có link chia sẻ hoặc không thể lấy danh sách:", checkErr);
          }

          // Nếu chưa có link, tạo link mới bằng POST /api/share-links
          if (!activeToken) {
            const body = targetType === "file"
              ? { fileId: Number(targetId) }
              : { folderId: Number(targetId) };

            const createRes = await fetchWithAuth("/share-links", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            });

            if (createRes && createRes.ok) {
              const data = await createRes.json();
              currentActiveShareLinkId = data.id;
              currentShareUrl = data.publicUrl;
              currentActiveToken = data.token || (data.publicUrl ? data.publicUrl.split("/").pop() : null);
              activeToken = currentActiveToken;
              if (typeof renderGeneralAccessUI === "function") {
                renderGeneralAccessUI("PUBLIC");
              }
            } else if (createRes) {
              // Nếu không tạo được (VD: không có quyền OWNER để tạo link công khai), fallback sang link nội bộ fileId
              webShareUrl = buildShareWebUrl(null, targetId, targetType);
            }
          }
        }

        if (activeToken) {
          webShareUrl = buildShareWebUrl(activeToken, targetId, targetType);
        } else if (currentShareUrl) {
          const extractedToken = currentShareUrl.split("/").pop();
          if (extractedToken) {
            webShareUrl = buildShareWebUrl(extractedToken, targetId, targetType);
          } else {
            webShareUrl = currentShareUrl;
          }
        }
      }

      if (!webShareUrl) {
        const errMsg = "Không tìm thấy hoặc không tạo được liên kết chia sẻ!";
        if (triggerBtn && typeof showShareError === "function") {
          showShareError(errMsg, false);
        } else {
          alert(errMsg);
        }
        return;
      }

      // 3. Sao chép link vào Clipboard
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(webShareUrl);
          copied = true;
        } catch (clipErr) {
          console.warn("navigator.clipboard không khả dụng, dùng textarea fallback:", clipErr);
        }
      }

      if (!copied) {
        const textArea = document.createElement("textarea");
        textArea.value = webShareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          copied = document.execCommand("copy");
        } catch (exErr) {
          console.error("Lỗi execCommand copy:", exErr);
        }
        document.body.removeChild(textArea);
      }

      // 4. Phản hồi người dùng
      if (triggerBtn) {
        triggerBtn.innerHTML = '<i class="ph ph-check" style="color: #10b981;"></i> Đã sao chép liên kết!';
        setTimeout(() => {
          if (triggerBtn) {
            triggerBtn.innerHTML = originalHtml;
          }
        }, 2500);
      } else {
        alert(`Đã sao chép liên kết xem trước tệp:\n${webShareUrl}`);
      }

    } catch (err) {
      console.error("Lỗi khi sao chép liên kết:", err);
      const errMsg = err.message || "Có lỗi xảy ra khi lấy liên kết chia sẻ!";
      if (triggerBtn && typeof showShareError === "function") {
        showShareError(errMsg, false);
      } else {
        alert(errMsg);
      }
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
      }
    }
  }
  window.copyResourceShareLink = copyResourceShareLink;

  document.getElementById("ctxCopyLink")?.addEventListener("click", () => {
    if (contextMenu) contextMenu.style.display = "none";
    if (currentTargetId && currentTargetType) {
      copyResourceShareLink(currentTargetId, currentTargetType);
    }
  });

  // Logic Thùng rác
  document.getElementById("ctxDelete")?.addEventListener("click", async () => {
    if (contextMenu) contextMenu.style.display = "none";
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

  // 3. Logic hiển thị và xóa lỗi trong Rename Modal
  function showRenameError(msg) {
    const errorLabel = document.getElementById("renameErrorMsg");
    const input = document.getElementById("renameInput");
    if (errorLabel) {
      errorLabel.textContent = msg;
      errorLabel.style.display = "block";
    }
    if (input) {
      input.classList.add("input-error");
      input.focus();
    }
  }

  function clearRenameError() {
    const errorLabel = document.getElementById("renameErrorMsg");
    const input = document.getElementById("renameInput");
    if (errorLabel) {
      errorLabel.textContent = "";
      errorLabel.style.display = "none";
    }
    if (input) {
      input.classList.remove("input-error");
    }
  }

  // Tự động xóa lỗi khi người dùng sửa tên trong ô nhập
  const renameInputEl = document.getElementById("renameInput");
  if (renameInputEl) {
    renameInputEl.addEventListener("input", clearRenameError);
    renameInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("confirmRenameBtn").click();
      }
    });
  }

  // Logic đóng mở Rename Modal
  document
    .getElementById("closeRenameModal")
    ?.addEventListener("click", () => {
      clearRenameError();
      if (renameOverlay) renameOverlay.style.display = "none";
    });
  document
    .getElementById("cancelRenameBtn")
    ?.addEventListener("click", () => {
      clearRenameError();
      if (renameOverlay) renameOverlay.style.display = "none";
    });

  // Đóng khi click ngoài modal box
  if (renameOverlay) {
    renameOverlay.addEventListener("click", (e) => {
      if (e.target === renameOverlay) {
        clearRenameError();
        renameOverlay.style.display = "none";
      }
    });
  }

  document.getElementById("confirmRenameBtn")?.addEventListener("click", async () => {
    clearRenameError();
    const newName = document.getElementById("renameInput")?.value.trim();
    if (!newName) {
      showRenameError("Vui lòng nhập tên mới!");
      return;
    }
    if (!currentTargetId) return;

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
        if (renameOverlay) renameOverlay.style.display = "none";
        loadDashboardData(window.currentViewType || "home");
      } else {
        const errData = await response.json().catch(() => ({}));
        showRenameError(errData.message || "Bạn không có quyền đổi tên file này!");
      }
    } catch (err) {
      console.error("Lỗi khi đổi tên:", err);
      showRenameError("Lỗi kết nối khi đổi tên!");
    }
  });

  // 4. Logic đóng mở Share Modal
  document
    .getElementById("closeShareModal")
    ?.addEventListener("click", () => {
      if (shareOverlay) shareOverlay.style.display = "none";
      if (typeof clearShareError === "function") clearShareError();
      const menu = document.getElementById("generalAccessMenu");
      if (menu) menu.style.display = "none";
      const btn = document.getElementById("generalAccessBtn");
      if (btn) btn.classList.remove("open");
      const shareInputGroup = document.querySelector(".share-input-group");
      if (shareInputGroup) shareInputGroup.style.display = "flex";
    });
  document
    .getElementById("doneShareBtn")
    ?.addEventListener("click", () => {
      if (shareOverlay) shareOverlay.style.display = "none";
      if (typeof clearShareError === "function") clearShareError();
      const menu = document.getElementById("generalAccessMenu");
      if (menu) menu.style.display = "none";
      const btn = document.getElementById("generalAccessBtn");
      if (btn) btn.classList.remove("open");
      const shareInputGroup = document.querySelector(".share-input-group");
      if (shareInputGroup) shareInputGroup.style.display = "flex";
    });

  const copyLinkBtnModal = document.getElementById("copyLinkBtnModal");
  if (copyLinkBtnModal) {
    copyLinkBtnModal.addEventListener("click", () => {
      if (currentTargetId && currentTargetType) {
        if (typeof clearShareError === "function") clearShareError();
        copyResourceShareLink(currentTargetId, currentTargetType, copyLinkBtnModal);
      }
    });
  }

  // ─── QUYỀN TRUY CẬP CHUNG (GENERAL ACCESS) ───
  function renderGeneralAccessUI(mode) {
    currentGeneralAccessMode = mode;
    const iconWrap = document.getElementById("generalAccessIconWrap");
    const icon = document.getElementById("generalAccessIcon");
    const label = document.getElementById("generalAccessLabel");
    const desc = document.getElementById("generalAccessDesc");
    const optRestricted = document.getElementById("optRestricted");
    const optPublic = document.getElementById("optPublic");

    const checkRestricted = optRestricted?.querySelector(".general-access-check i");
    const checkPublic = optPublic?.querySelector(".general-access-check i");

    if (mode === "PUBLIC") {
      if (iconWrap) iconWrap.classList.add("is-public");
      if (icon) icon.className = "ph ph-globe";
      if (label) label.textContent = "Bất kỳ ai có đường liên kết";
      if (desc) desc.textContent = "Bất kỳ ai trên Internet có đường liên kết này đều có thể xem";

      if (optRestricted) optRestricted.classList.remove("selected");
      if (checkRestricted) checkRestricted.style.display = "none";

      if (optPublic) optPublic.classList.add("selected");
      if (checkPublic) checkPublic.style.display = "inline-flex";
    } else {
      if (iconWrap) iconWrap.classList.remove("is-public");
      if (icon) icon.className = "ph ph-lock";
      if (label) label.textContent = "Hạn chế";
      if (desc) desc.textContent = "Chỉ những người có quyền truy cập mới có thể mở bằng đường liên kết này";

      if (optRestricted) optRestricted.classList.add("selected");
      if (checkRestricted) checkRestricted.style.display = "inline-flex";

      if (optPublic) optPublic.classList.remove("selected");
      if (checkPublic) checkPublic.style.display = "none";
    }
  }
  window.renderGeneralAccessUI = renderGeneralAccessUI;

  async function setGeneralAccessMode(newMode) {
    if (newMode === currentGeneralAccessMode) return;

    const isOwner = !window.currentTargetPermission || window.currentTargetPermission === "OWNER";
    if (!isOwner) {
      alert("Chỉ chủ sở hữu (Owner) mới có quyền thay đổi quyền truy cập chung!");
      return;
    }

    const targetId = currentTargetId;
    const targetType = currentTargetType;
    if (!targetId || !targetType) return;

    if (newMode === "PUBLIC") {
      // 1. Chuyển sang công khai: Tạo link qua POST /api/share-links
      try {
        const body = targetType === "file" ? { fileId: Number(targetId) } : { folderId: Number(targetId) };
        const res = await fetchWithAuth("/share-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (res && res.ok) {
          const data = await res.json();
          currentActiveShareLinkId = data.id;
          currentShareUrl = data.publicUrl;
          currentActiveToken = data.token || (data.publicUrl ? data.publicUrl.split("/").pop() : null);
          renderGeneralAccessUI("PUBLIC");
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.message || "Không thể chuyển sang chế độ Bất kỳ ai có đường liên kết!");
        }
      } catch (err) {
        console.error("Lỗi khi chuyển quyền truy cập chung sang công khai:", err);
        alert("Lỗi khi kết nối đến máy chủ!");
      }
    } else {
      // 2. Chuyển về HẠN CHẾ: Thu hồi link chia sẻ công khai qua DELETE /api/share-links/{id}
      try {
        if (currentActiveShareLinkId) {
          await fetchWithAuth(`/share-links/${currentActiveShareLinkId}`, {
            method: "DELETE"
          });
        } else {
          const queryParam = targetType === "file" ? `fileId=${targetId}` : `folderId=${targetId}`;
          const checkRes = await fetchWithAuth(`/share-links?${queryParam}`);
          if (checkRes && checkRes.ok) {
            const links = await checkRes.json();
            for (const l of links) {
              if (l.id && l.isActive !== false) {
                await fetchWithAuth(`/share-links/${l.id}`, { method: "DELETE" });
              }
            }
          }
        }
        currentActiveShareLinkId = null;
        currentShareUrl = null;
        currentActiveToken = null;
        renderGeneralAccessUI("RESTRICTED");
      } catch (err) {
        console.error("Lỗi khi thu hồi link chia sẻ:", err);
        currentActiveShareLinkId = null;
        currentShareUrl = null;
        currentActiveToken = null;
        renderGeneralAccessUI("RESTRICTED");
      }
    }
  }
  window.setGeneralAccessMode = setGeneralAccessMode;

  async function initGeneralAccessModal(targetId, targetType) {
    const isOwner = !window.currentTargetPermission || window.currentTargetPermission === "OWNER";
    const btn = document.getElementById("generalAccessBtn");
    const menu = document.getElementById("generalAccessMenu");
    if (menu) menu.style.display = "none";
    if (btn) btn.classList.remove("open");

    if (!isOwner) {
      if (btn) {
        btn.style.cursor = "default";
        btn.title = "Chỉ chủ sở hữu mới có quyền thay đổi";
        const caret = btn.querySelector(".general-access-caret");
        if (caret) caret.style.display = "none";
      }
    } else {
      if (btn) {
        btn.style.cursor = "pointer";
        btn.removeAttribute("title");
        const caret = btn.querySelector(".general-access-caret");
        if (caret) caret.style.display = "inline-block";
      }
    }

    currentActiveShareLinkId = null;
    currentShareUrl = null;
    currentActiveToken = null;
    renderGeneralAccessUI("RESTRICTED");

    if (isOwner && targetId && targetType) {
      try {
        const queryParam = targetType === "file" ? `fileId=${targetId}` : `folderId=${targetId}`;
        const res = await fetchWithAuth(`/share-links?${queryParam}`);
        if (res && res.ok) {
          const links = await res.json();
          if (Array.isArray(links) && links.length > 0) {
            const activeLink = links.find(l => l.isActive !== false) || links[0];
            if (activeLink && activeLink.isActive !== false) {
              currentActiveShareLinkId = activeLink.id;
              currentShareUrl = activeLink.publicUrl;
              currentActiveToken = activeLink.token || (activeLink.publicUrl ? activeLink.publicUrl.split("/").pop() : null);
              renderGeneralAccessUI("PUBLIC");
            }
          }
        }
      } catch (e) {
        console.warn("Lỗi kiểm tra link chia sẻ hiện có:", e);
      }
    }
  }
  window.initGeneralAccessModal = initGeneralAccessModal;

  const generalAccessBtn = document.getElementById("generalAccessBtn");
  const generalAccessMenu = document.getElementById("generalAccessMenu");

  if (generalAccessBtn && generalAccessMenu) {
    generalAccessBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOwner = !window.currentTargetPermission || window.currentTargetPermission === "OWNER";
      if (!isOwner) {
        alert("Chỉ chủ sở hữu (Owner) mới có quyền thay đổi quyền truy cập chung!");
        return;
      }
      const isOpen = generalAccessMenu.style.display === "block";
      generalAccessMenu.style.display = isOpen ? "none" : "block";
      generalAccessBtn.classList.toggle("open", !isOpen);
    });

    document.getElementById("optRestricted")?.addEventListener("click", (e) => {
      e.stopPropagation();
      generalAccessMenu.style.display = "none";
      generalAccessBtn.classList.remove("open");
      setGeneralAccessMode("RESTRICTED");
    });

    document.getElementById("optPublic")?.addEventListener("click", (e) => {
      e.stopPropagation();
      generalAccessMenu.style.display = "none";
      generalAccessBtn.classList.remove("open");
      setGeneralAccessMode("PUBLIC");
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#generalAccessDropdownWrapper")) {
        if (generalAccessMenu) generalAccessMenu.style.display = "none";
        if (generalAccessBtn) generalAccessBtn.classList.remove("open");
      }
    });
  }

  // 5. Logic đóng Preview Modal
  const closePreviewBtn = document.getElementById("closePreviewModal");
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener("click", closeFilePreview);
  }

  const previewOverlayEl = document.getElementById("previewModalOverlay");
  if (previewOverlayEl) {
    previewOverlayEl.addEventListener("click", (e) => {
      if (e.target === previewOverlayEl) {
        closeFilePreview();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const pOverlay = document.getElementById("previewModalOverlay");
      if (pOverlay && pOverlay.style.display === "flex") {
        closeFilePreview();
      }
    }
  });

  function showShareError(msg, highlightInput = true) {
    const errorLabel = document.getElementById("shareErrorMsg");
    const emailInput = document.getElementById("shareEmailInput");
    if (errorLabel) {
      errorLabel.textContent = msg;
      errorLabel.style.display = "block";
    }
    if (emailInput && highlightInput) {
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

  document.getElementById("addShareUserBtn")?.addEventListener("click", async () => {
    clearShareError();
    const emailInput = document.getElementById("shareEmailInput");
    const roleSelect = document.getElementById("shareRoleSelect");
    if (!emailInput || !roleSelect) return;
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

  // Tự động mở xem trước nếu URL có param token hoặc fileId (hỗ trợ cả khi mở dashboard.html?token=...)
  const pageParams = new URLSearchParams(window.location.search);
  const paramToken = pageParams.get("token") || pageParams.get("shareToken");
  const paramFileId = pageParams.get("fileId") || pageParams.get("previewFileId");

  if (paramToken && typeof openPublicFilePreview === "function") {
    openPublicFilePreview(paramToken);
  } else if (paramFileId && typeof openFilePreview === "function") {
    openFilePreview(paramFileId);
  }
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
/**
 * createSharedUserMetaNode(item) - Tạo phần tử DOM hiển thị avatar và tên người chia sẻ (XSS-safe)
 */
function createSharedUserMetaNode(item) {
  const sharerName = typeof formatSharerName === "function" ? formatSharerName(item) : (item.ownerName || "Ai đó");
  const initials = typeof getInitials === "function" ? getInitials(sharerName) : "U";
  const avatarColors = ["avatar-bg-blue", "avatar-bg-pink", "avatar-bg-orange", "avatar-bg-emerald", "avatar-bg-purple", "avatar-bg-cyan"];
  const colorIndex = typeof hashCode === "function" ? Math.abs(hashCode(sharerName)) % avatarColors.length : 0;
  const avatarColor = avatarColors[colorIndex];

  const metaWrap = document.createElement("div");
  metaWrap.className = "shared-user-meta";

  const avatarEl = document.createElement("div");
  avatarEl.className = `shared-user-avatar ${avatarColor}`;
  avatarEl.textContent = initials;

  const nameSpan = document.createElement("span");
  nameSpan.className = "shared-user-name";
  nameSpan.title = sharerName;
  nameSpan.textContent = sharerName;

  metaWrap.appendChild(avatarEl);
  metaWrap.appendChild(nameSpan);
  return metaWrap;
}

/**
 * renderFolders(folders, viewType) - Render danh sách thư mục sử dụng HTML5 <template id="tmpl-folder-card">
 * @param {Array}  folders  - Mảng object thư mục (từ backend hoặc mockData)
 * @param {string} viewType - Tab hiện tại: 'home' | 'shared' | 'trash'
 */
function renderFolders(folders, viewType = "home") {
  const foldersContainer = document.querySelector(".grid-folders");
  if (!foldersContainer) return;
  foldersContainer.innerHTML = ""; // Xóa dữ liệu cũ

  if (!folders || folders.length === 0) {
    foldersContainer.innerHTML =
      '<p style="color: var(--text-muted); font-size: 14px;">Không có thư mục nào.</p>';
    return;
  }

  folders.forEach((folder) => {
    const colors = ["blue", "purple", "cyan", "green"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const folderId = folder.folderId || folder.id;
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

    // Nhân bản từ <template id="tmpl-folder-card">
    const fragment = cloneTemplate("tmpl-folder-card");
    let folderCard;
    if (fragment) {
      folderCard = fragment.querySelector(".folder-card");
    } else {
      folderCard = document.createElement("div");
      folderCard.className = "folder-card";
    }

    folderCard.dataset.id = folderId;

    // Nút ba chấm mở Context Menu
    const moreOptions = folderCard.querySelector(".more-options");
    if (moreOptions) {
      moreOptions.onclick = (e) => window.openContextMenu(e, folderId, "folder");
    }

    // Icon thư mục
    const folderColor = folder.color || randomColor || "blue";
    const folderBox = folderCard.querySelector(".folder-icon-box");
    if (folderBox) {
      folderBox.className = `folder-icon-box ${folderColor}`;
    }
    const iconEl = folderCard.querySelector(".folder-icon");
    if (iconEl) {
      iconEl.className = `ph-fill ph-folder folder-icon ${folderColor}`;
    }

    // Tên thư mục (gán qua textContent chống XSS)
    const nameEl = folderCard.querySelector(".folder-name");
    if (nameEl) {
      nameEl.textContent = folderName;
      nameEl.title = folderName;
    }

    // Ngày sửa
    const metaMobile = folderCard.querySelector(".file-meta-mobile");
    if (metaMobile) metaMobile.textContent = displayDate;
    const dateCol = folderCard.querySelector(".file-date");
    if (dateCol) dateCol.textContent = displayDate;

    // Badges chia sẻ (cả dạng Grid và List)
    const badges = folderCard.querySelectorAll(".shared-badge");
    badges.forEach((b) => {
      b.textContent = folderBadgeText;
      b.className = folderBadgeClass;
    });

    // Thông tin người chia sẻ (tab 'shared')
    if (viewType === "shared") {
      const slot = folderCard.querySelector(".shared-user-meta-slot") || folderCard.querySelector(".file-info-main");
      if (slot) {
        slot.appendChild(createSharedUserMetaNode(folder));
      }
    }

    // Tự động kiểm tra nếu folder chính chủ đã được chia sẻ cho người khác
    if ((!folderPerm || folderPerm === "OWNER") && !isSharedVal && viewType !== "shared") {
      fetchWithAuth(`/shares/users?folderId=${folderId}`)
        .then(async (res) => {
          if (res && res.ok) {
            const users = await res.json();
            const recipients = users.filter((u) => u.permission !== "OWNER");
            if (recipients.length > 0) {
              const bList = folderCard.querySelectorAll(".shared-badge");
              bList.forEach((b) => {
                b.textContent = "Đã chia sẻ";
                b.className = "shared-badge active";
              });
            }
          }
        })
        .catch(() => { });
    }

    // Sự kiện mở thư mục
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
 * renderFiles(files, viewType) - Render danh sách tệp tin sử dụng HTML5 <template id="tmpl-file-card">
 * @param {Array}  files    - Mảng object file (từ backend hoặc mockData)
 * @param {string} viewType - Tab hiện tại: 'home' | 'shared' | 'trash'
 */
function renderFiles(files, viewType = "home") {
  const filesContainer = document.querySelector(".grid-files");
  if (!filesContainer) return;

  const existingListHeader = filesContainer.querySelector(".list-header");
  filesContainer.innerHTML = ""; // Xóa dữ liệu cũ

  if (!files || files.length === 0) {
    filesContainer.innerHTML =
      '<p style="color: var(--text-muted); font-size: 14px;">Không có tệp tin nào.</p>';
    return;
  }

  // Giữ lại hoặc tạo mới List Header
  if (existingListHeader) {
    filesContainer.appendChild(existingListHeader);
  } else {
    const listHeader = document.createElement("div");
    listHeader.className = "list-header";
    listHeader.innerHTML = `
      <div class="col-name">TÊN</div>
      <div class="col-date">NGÀY SỬA</div>
      <div class="col-size">KÍCH THƯỚC</div>
      <div class="col-shared">CHIA SẺ</div>
    `;
    filesContainer.appendChild(listHeader);
  }

  // Định dạng kích thước file
  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  files.forEach((file) => {
    const fileId = file.fileId || file.id;
    const displayFileName = file.fileName || file.name || "Không tên";

    const { ext, iconClass, colorClass } = getFileCategoryAndIcon(displayFileName);

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

    const displayDate = formatSmartDate(file.updatedAt || file.createdAt);

    // Nhân bản từ <template id="tmpl-file-card">
    const fragment = cloneTemplate("tmpl-file-card");
    let fileCard;
    if (fragment) {
      fileCard = fragment.querySelector(".file-card");
    } else {
      fileCard = document.createElement("div");
      fileCard.className = "file-card";
    }

    fileCard.dataset.id = fileId;

    // Nút ba chấm mở Context Menu
    const moreOptions = fileCard.querySelector(".more-options");
    if (moreOptions) {
      moreOptions.onclick = (e) => window.openContextMenu(e, fileId, "file");
    }

    // Icon tệp tin
    const iconBox = fileCard.querySelector(".file-icon-box");
    if (iconBox) {
      iconBox.className = `file-icon-box ${colorClass}`;
      const iconEl = iconBox.querySelector("i");
      if (iconEl) iconEl.className = `ph ${iconClass}`;
    }

    // Tên tệp tin (gán qua textContent chống XSS)
    const nameEl = fileCard.querySelector(".file-name");
    if (nameEl) {
      nameEl.textContent = displayFileName;
      nameEl.title = displayFileName;
    }

    // Ngày sửa và kích thước
    const metaMobile = fileCard.querySelector(".file-meta-mobile");
    if (metaMobile) metaMobile.textContent = `${displayDate} · ${displaySize}`;
    const dateCol = fileCard.querySelector(".file-date");
    if (dateCol) dateCol.textContent = displayDate;
    const sizeCol = fileCard.querySelector(".file-size");
    if (sizeCol) sizeCol.textContent = displaySize;

    // Badges chia sẻ
    const badges = fileCard.querySelectorAll(".shared-badge");
    badges.forEach((b) => {
      b.textContent = fileBadgeText;
      b.className = fileBadgeClass;
    });

    // Thông tin người chia sẻ (tab 'shared')
    if (viewType === "shared") {
      const slot = fileCard.querySelector(".shared-user-meta-slot") || fileCard.querySelector(".file-info-main");
      if (slot) {
        slot.appendChild(createSharedUserMetaNode(file));
      }
    }

    // Tự động kiểm tra nếu file chính chủ đã được chia sẻ cho người khác
    if ((!filePerm || filePerm === "OWNER") && !isSharedVal && viewType !== "shared") {
      fetchWithAuth(`/shares/users?fileId=${fileId}`)
        .then(async (res) => {
          if (res && res.ok) {
            const users = await res.json();
            const recipients = users.filter((u) => u.permission !== "OWNER");
            if (recipients.length > 0) {
              const bList = fileCard.querySelectorAll(".shared-badge");
              bList.forEach((b) => {
                b.textContent = "Đã chia sẻ";
                b.className = "shared-badge active";
              });
            }
          }
        })
        .catch(() => { });
    }

    // Sự kiện mở modal xem trước
    fileCard.addEventListener("click", (e) => {
      if (e.target.closest(".more-options")) return;
      console.log("Xem trước file:", fileId);
      openFilePreview(fileId, file);
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
        const { iconClass } = getFileCategoryAndIcon(file.name);
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

  sharedFiles.forEach(f => {
    if (!f.id && f.fileId) f.id = f.fileId;
    if (!f.fileName && f.name) f.fileName = f.name;
  });
  sharedFolders.forEach(f => {
    if (!f.id && f.folderId) f.id = f.folderId;
    if (!f.folderName && f.name) f.folderName = f.name;
  });

  window.currentLoadedData = {
    folders: sharedFolders,
    files: sharedFiles
  };

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
  if (!fileName) return '<i class="ph ph-file file-default"></i>';
  const { iconClass, colorClass } = getFileCategoryAndIcon(fileName);
  return `<i class="ph ${iconClass} ${colorClass}"></i>`;
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
  trashList.style.display = "";
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
        <div class="trash-icon-box blue">
          <i class="ph-fill ph-folder"></i>
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
    const { iconClass, colorClass } = getFileCategoryAndIcon(fileName);

    html += `
      <div class="trash-item">
        <div class="trash-checkbox" onclick="toggleTrashSelection(this)"></div>
        <div class="trash-icon-box ${colorClass}">
          <i class="ph ${iconClass}"></i>
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

window.toggleTrashSelection = function (el) {
  el.classList.toggle('selected');
};

window.restoreTrashItem = async function (id, type) {
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

window.permanentDeleteTrashItem = async function (id, type) {
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
