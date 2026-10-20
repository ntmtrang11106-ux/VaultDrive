// frontend/js/settings.js

function renderSettingsView() {
  const container = document.getElementById("settings-view-container");
  if (!container) return;

  container.style.display = "block";

  // Data will be loaded after HTML is fetched by dashboard.js
  loadUserProfile();
}

function switchSettingsTab(tab) {
  clearSettingsPasswordErrors();
  document.getElementById("tab-profile").classList.remove("active");
  document.getElementById("tab-password").classList.remove("active");
  document.getElementById("settings-content-profile").style.display = "none";
  document.getElementById("settings-content-password").style.display = "none";

  if (tab === 'profile') {
    document.getElementById("tab-profile").classList.add("active");
    document.getElementById("settings-content-profile").style.display = "block";
  } else {
    document.getElementById("tab-password").classList.add("active");
    document.getElementById("settings-content-password").style.display = "block";
  }
}

function togglePasswordVisibility(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    iconEl.classList.replace("ph-eye", "ph-eye-slash");
  } else {
    input.type = "password";
    iconEl.classList.replace("ph-eye-slash", "ph-eye");
  }
}

let isEditingProfile = false;
function toggleEditProfile() {
  isEditingProfile = !isEditingProfile;

  const fields = ["inputFullName", "inputPhone", "inputDob", "inputGender"];
  fields.forEach(id => {
    document.getElementById(id).disabled = !isEditingProfile;
  });

  const btnEdit = document.getElementById("btnEditProfile");
  const btnSave = document.getElementById("btnSaveProfile");

  if (isEditingProfile) {
    btnEdit.innerHTML = `<i class="ph ph-x"></i> Hủy`;
    btnEdit.classList.add("cancel-mode");
    btnSave.style.display = "block";
    document.getElementById("inputFullName").focus();
  } else {
    btnEdit.innerHTML = `<i class="ph ph-pencil-simple"></i> Chỉnh sửa`;
    btnEdit.classList.remove("cancel-mode");
    btnSave.style.display = "none";
    loadUserProfile(); // Revert changes
  }
}

async function loadUserProfile() {
  try {
    const response = await fetchWithAuth("/users/me");
    let data = null;
    if (response && response.ok) {
      data = await response.json();
    } else {
      const savedProfile = JSON.parse(localStorage.getItem("mock_user_profile") || "null");
      data = savedProfile || {
        fullName: "Người dùng",
        email: "user@example.com",
        phone: "",
        dob: "",
        gender: ""
      };
    }

    document.getElementById("settingsFullName").textContent = data.fullName || "Người dùng";
    document.getElementById("settingsEmail").textContent = data.email || "";

    const initials = (data.fullName || "U").substring(0, 2).toUpperCase();
    document.getElementById("settingsAvatar").textContent = initials;

    document.getElementById("inputFullName").value = data.fullName || "";
    document.getElementById("inputEmail").value = data.email || "";
    document.getElementById("inputPhone").value = data.phone || "";
    document.getElementById("inputDob").value = data.dob || "";
    document.getElementById("inputGender").value = data.gender || "";
  } catch (error) {
    console.error("Lỗi khi tải thông tin cá nhân:", error);
  }
}

async function saveProfile() {
  const fullName = document.getElementById("inputFullName").value.trim();
  const phone = document.getElementById("inputPhone").value.trim();
  const dob = document.getElementById("inputDob").value;
  const gender = document.getElementById("inputGender").value;

  try {
    const response = await fetchWithAuth("/users/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, dob: dob || null, gender })
    });

    if (response && response.ok) {
      alert("Cập nhật thông tin cá nhân thành công!");
      toggleEditProfile();
      if (typeof fetchUserInfo === "function") {
        fetchUserInfo();
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      alert(errData.message || "Cập nhật thông tin thất bại!");
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật profile:", error);
    alert("Có lỗi xảy ra khi cập nhật thông tin!");
  }
}

// Hàm hiển thị lỗi dưới ô nhập mật khẩu
function showSettingsFieldError(inputId, message) {
  const inputEl = document.getElementById(inputId);
  const errorEl = document.getElementById(inputId + "Error");
  if (inputEl) {
    inputEl.classList.add("input-error");
  }
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

// Hàm xóa toàn bộ lỗi ở phần mật khẩu
function clearSettingsPasswordErrors() {
  const container = document.getElementById("settings-content-password");
  if (!container) return;
  container.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
    el.style.display = "none";
  });
  container.querySelectorAll(".input-error").forEach((el) => {
    el.classList.remove("input-error");
  });
}

// Tự động xóa lỗi khi người dùng gõ vào ô nhập trong Settings
document.addEventListener("input", function (e) {
  if (e.target && e.target.classList.contains("settings-form-control")) {
    e.target.classList.remove("input-error");
    const errorEl = document.getElementById(e.target.id + "Error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }
  }
});

async function savePassword() {
  clearSettingsPasswordErrors();

  const currentPassword = document.getElementById("inputCurrentPassword").value;
  const newPassword = document.getElementById("inputNewPassword").value;
  const confirmPassword = document.getElementById("inputConfirmPassword").value;

  let hasError = false;

  if (!currentPassword) {
    showSettingsFieldError("inputCurrentPassword", "Vui lòng nhập mật khẩu hiện tại!");
    hasError = true;
  }
  if (!newPassword) {
    showSettingsFieldError("inputNewPassword", "Vui lòng nhập mật khẩu mới!");
    hasError = true;
  }

  // Tiêu chuẩn bảo mật đồng bộ với trang Đăng ký (từ 8 ký tự, bắt đầu bằng chữ hoa, có số và ký tự đặc biệt)
  const pwdRegex = /^[A-Z](?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{7,}$/;
  if (!pwdRegex.test(newPassword)) {
    showSettingsFieldError(
      "inputNewPassword",
      "Mật khẩu phải từ 8 ký tự, bắt đầu bằng chữ hoa, có số và ký tự đặc biệt (@, $, !, %, *, ?, &, #)!"
    );
    hasError = true;
  }

  if (!confirmPassword) {
    showSettingsFieldError("inputConfirmPassword", "Vui lòng xác nhận lại mật khẩu mới!");
    hasError = true;
  }

  if (newPassword === currentPassword) {
    showSettingsFieldError("inputNewPassword", "Mật khẩu mới không được trùng với mật khẩu hiện tại!");
    hasError = true;
  }

  // Dừng lại nếu có ô chưa nhập
  if (hasError) return;

  if (newPassword !== confirmPassword) {
    showSettingsFieldError("inputConfirmPassword", "Xác nhận mật khẩu mới không khớp!");
    hasError = true;
  }

  // Dừng lại nếu định dạng không hợp lệ
  if (hasError) return;

  try {
    const response = await fetchWithAuth("/users/change-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });

    if (response && response.ok) {
      alert("Cập nhật mật khẩu thành công!");
      document.getElementById("inputCurrentPassword").value = "";
      document.getElementById("inputNewPassword").value = "";
      document.getElementById("inputConfirmPassword").value = "";
      clearSettingsPasswordErrors();
    } else {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.message || "Cập nhật mật khẩu thất bại!";
      const lower = msg.toLowerCase();
      if (
        lower.includes("hiện tại") ||
        lower.includes("current") ||
        lower.includes("sai") ||
        lower.includes("không chính xác")
      ) {
        showSettingsFieldError("inputCurrentPassword", msg);
      } else if (lower.includes("khớp") || lower.includes("xác nhận") || lower.includes("confirm")) {
        showSettingsFieldError("inputConfirmPassword", msg);
      } else if (lower.includes("mới") || lower.includes("new")) {
        showSettingsFieldError("inputNewPassword", msg);
      } else {
        showSettingsFieldError("inputCurrentPassword", msg);
      }
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật mật khẩu:", error);
    showSettingsFieldError("inputCurrentPassword", "Có lỗi xảy ra khi cập nhật mật khẩu!");
  }
}
