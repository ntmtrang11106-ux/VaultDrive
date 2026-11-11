// frontend/js/settings.js

function renderSettingsView() {
  const container = document.getElementById("settings-view-container");
  if (!container) return;

  container.style.display = "block";

  // Data will be loaded after HTML is fetched by dashboard.js
  loadUserProfile();
}

function switchSettingsTab(tab) {
  clearSettingsProfileErrors();
  clearSettingsPasswordErrors();
  document.getElementById("tab-profile").classList.remove("active");
  document.getElementById("tab-password").classList.remove("active");
  document.getElementById("settings-content-profile").style.display = "none";
  document.getElementById("settings-content-password").style.display = "none";

  if (tab === "profile") {
    document.getElementById("tab-profile").classList.add("active");
    document.getElementById("settings-content-profile").style.display = "block";
  } else {
    document.getElementById("tab-password").classList.add("active");
    document.getElementById("settings-content-password").style.display =
      "block";
  }
}

function togglePasswordVisibility(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
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
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !isEditingProfile;
  });

  const btnEdit = document.getElementById("btnEditProfile");
  const btnSave = document.getElementById("btnSaveProfile");

  if (isEditingProfile) {
    clearSettingsProfileErrors();
    if (btnEdit) {
      btnEdit.innerHTML = `<i class="ph ph-x"></i> Hủy`;
      btnEdit.classList.add("cancel-mode");
    }
    if (btnSave) btnSave.style.display = "block";
    const nameEl = document.getElementById("inputFullName");
    if (nameEl) nameEl.focus();
  } else {
    clearSettingsProfileErrors();
    if (btnEdit) {
      btnEdit.innerHTML = `<i class="ph ph-pencil-simple"></i> Chỉnh sửa`;
      btnEdit.classList.remove("cancel-mode");
    }
    if (btnSave) btnSave.style.display = "none";
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
      const savedProfile = JSON.parse(
        localStorage.getItem("mock_user_profile") || "null",
      );
      const userEmail =
        localStorage.getItem("user_email") || "admin@vaultdrive.com";
      const isRoleAdmin =
        localStorage.getItem("user_role") === "ROLE_ADMIN" ||
        window.location.search.includes("tab=soc");
      data = savedProfile || {
        fullName: isRoleAdmin ? "System Administrator" : "Người dùng",
        email: userEmail,
        phone: "",
        dob: "",
        gender: "",
      };
    }

    const isAdmin =
      localStorage.getItem("user_role") === "ROLE_ADMIN" ||
      window.location.search.includes("tab=soc");
    const roleLabel = isAdmin
      ? "Tài khoản Quản trị viên (Admin)"
      : "Gói Cá nhân · 10 GB";
    const planInfoEl = document.querySelector(
      ".settings-user-details .plan-info",
    );
    if (planInfoEl) planInfoEl.textContent = roleLabel;

    const displayName =
      data.fullName || (isAdmin ? "System Administrator" : "Người dùng");
    const emailValue = data.email || localStorage.getItem("user_email") || "";

    const nameTitle = document.getElementById("settingsFullName");
    const emailTitle = document.getElementById("settingsEmail");
    const avatarEl = document.getElementById("settingsAvatar");

    if (nameTitle) nameTitle.textContent = displayName;
    if (emailTitle) emailTitle.textContent = emailValue;

    const initials = (
      displayName.includes(" ")
        ? displayName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
        : displayName.substring(0, 2)
    ).toUpperCase();
    if (avatarEl) avatarEl.textContent = initials || "AD";

    // Đồng bộ ngay lập tức sang Sidebar (Họ và tên & Avatar hai chữ cái đầu)
    if (data && data.fullName) {
      localStorage.setItem("user_fullname", data.fullName);
      const cur = JSON.parse(localStorage.getItem("mock_user_profile") || "{}");
      localStorage.setItem("mock_user_profile", JSON.stringify({ ...cur, ...data }));
    }
    const sideUserName = document.getElementById("userName");
    const sideUserAvatar = document.getElementById("userAvatar");
    if (sideUserName) sideUserName.textContent = displayName;
    if (sideUserAvatar) sideUserAvatar.textContent = initials;

    const inName = document.getElementById("inputFullName");
    const inEmail = document.getElementById("inputEmail");
    const inPhone = document.getElementById("inputPhone");
    const inDob = document.getElementById("inputDob");
    const inGender = document.getElementById("inputGender");

    if (inName)
      inName.value = data.fullName || (isAdmin ? "System Administrator" : "");
    if (inEmail) inEmail.value = emailValue;
    if (inPhone) inPhone.value = data.phone || "";
    if (inDob) inDob.value = data.dob || "";
    if (inGender) {
      const rawGender = String(data.gender || "").trim().toUpperCase();
      let matched = false;
      for (let i = 0; i < inGender.options.length; i++) {
        const optVal = inGender.options[i].value;
        if (optVal && optVal.toUpperCase() === rawGender) {
          inGender.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) {
        inGender.value = "";
      }
    }
  } catch (error) {
    console.error("Lỗi khi tải thông tin cá nhân:", error);
  }
}

// Hàm hiển thị lỗi dưới ô nhập
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

// Hàm xóa lỗi phần thông tin cá nhân
function clearSettingsProfileErrors() {
  const container = document.getElementById("settings-content-profile");
  if (!container) return;
  container.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
    el.style.display = "none";
  });
  container.querySelectorAll(".input-error").forEach((el) => {
    el.classList.remove("input-error");
  });
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

// Tự động xóa lỗi khi người dùng gõ vào bất kỳ ô nhập nào trong Settings
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

// 1. CẬP NHẬT THÔNG TIN CÁ NHÂN (Có kiểm tra đầy đủ điều kiện)
async function saveProfile() {
  clearSettingsProfileErrors();

  const fullNameInput = document.getElementById("inputFullName");
  const phoneInput = document.getElementById("inputPhone");
  const dobInput = document.getElementById("inputDob");
  const genderInput = document.getElementById("inputGender");

  const fullName = fullNameInput ? fullNameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const dob = dobInput ? dobInput.value : "";
  const gender = genderInput ? genderInput.value : "";

  let hasError = false;

  // (A) Kiểm tra Họ và tên
  if (!fullName) {
    showSettingsFieldError("inputFullName", "Vui lòng nhập họ và tên!");
    hasError = true;
  } else if (fullName.length < 2) {
    showSettingsFieldError(
      "inputFullName",
      "Họ và tên phải có ít nhất 2 ký tự!",
    );
    hasError = true;
  }

  // (B) Kiểm tra Số điện thoại: Bắt buộc đúng 10 chữ số (bắt đầu bằng 0)
  if (!phone) {
    showSettingsFieldError("inputPhone", "Vui lòng nhập số điện thoại!");
    hasError = true;
  } else {
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
      showSettingsFieldError(
        "inputPhone",
        "Số điện thoại không hợp lệ (phải đúng 10 chữ số và bắt đầu bằng số 0)!",
      );
      hasError = true;
    }
  }

  // (C) Kiểm tra Ngày sinh: Không được chọn ngày trong tương lai
  if (dob) {
    const selectedDate = new Date(dob);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      showSettingsFieldError(
        "inputDob",
        "Ngày sinh không hợp lệ (không thể chọn ngày trong tương lai)!",
      );
      hasError = true;
    }
  }

  // Dừng lại nếu có lỗi
  if (hasError) return;

  try {
    const response = await fetchWithAuth("/users/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, dob: dob || null, gender }),
    });

    if (response && response.ok) {
      alert("Cập nhật thông tin cá nhân thành công!");

      // Lưu cache local
      localStorage.setItem(
        "mock_user_profile",
        JSON.stringify({
          fullName,
          phone,
          dob,
          gender,
          email: document.getElementById("inputEmail")
            ? document.getElementById("inputEmail").value
            : "",
        }),
      );

      const initials = (
        fullName.includes(" ")
          ? fullName
              .split(" ")
              .filter(Boolean)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
          : fullName.substring(0, 2)
      ).toUpperCase() || "U";

      // Cập nhật thẻ Header Settings
      const nameTitle = document.getElementById("settingsFullName");
      const avatarEl = document.getElementById("settingsAvatar");
      if (nameTitle) nameTitle.textContent = fullName;
      if (avatarEl) avatarEl.textContent = initials;

      // Cập nhật ngay lập tức tên & avatar bên cạnh Avatar trên Sidebar
      if (typeof window.renderUserInfo === "function") {
        window.renderUserInfo();
      } else {
        const userNameEl = document.getElementById("userName");
        const userAvatarEl = document.getElementById("userAvatar");
        if (userNameEl) userNameEl.textContent = fullName;
        if (userAvatarEl) userAvatarEl.textContent = initials;

        const topNameEl = document.getElementById("adminTopName");
        const dropNameEl = document.getElementById("adminDropdownName");
        if (topNameEl) topNameEl.textContent = fullName;
        if (dropNameEl)
          dropNameEl.textContent = "Quản trị viên (" + fullName + ")";
      }

      toggleEditProfile();
    } else {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.message || "Cập nhật thông tin thất bại!";
      const lower = msg.toLowerCase();
      if (
        lower.includes("phone") ||
        lower.includes("thoại") ||
        lower.includes("số")
      ) {
        showSettingsFieldError("inputPhone", msg);
      } else if (lower.includes("name") || lower.includes("tên")) {
        showSettingsFieldError("inputFullName", msg);
      } else {
        alert(msg);
      }
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật profile:", error);
    alert("Có lỗi xảy ra khi cập nhật thông tin!");
  }
}

// 2. ĐỔI MẬT KHẨU (Có kiểm tra đầy đủ điều kiện bảo mật)
async function savePassword() {
  clearSettingsPasswordErrors();

  const currentPasswordInput = document.getElementById("inputCurrentPassword");
  const newPasswordInput = document.getElementById("inputNewPassword");
  const confirmPasswordInput = document.getElementById("inputConfirmPassword");

  const currentPassword = currentPasswordInput
    ? currentPasswordInput.value
    : "";
  const newPassword = newPasswordInput ? newPasswordInput.value : "";
  const confirmPassword = confirmPasswordInput
    ? confirmPasswordInput.value
    : "";

  let hasError = false;

  // (A) Kiểm tra Mật khẩu hiện tại
  if (!currentPassword) {
    showSettingsFieldError(
      "inputCurrentPassword",
      "Vui lòng nhập mật khẩu hiện tại!",
    );
    hasError = true;
  }

  // (B) Kiểm tra Mật khẩu mới
  if (!newPassword) {
    showSettingsFieldError("inputNewPassword", "Vui lòng nhập mật khẩu mới!");
    hasError = true;
  } else {
    // Tiêu chuẩn bảo mật: Từ 8 ký tự, bắt đầu bằng chữ hoa, có số và ký tự đặc biệt
    const pwdRegex =
      /^[A-Z](?=.*\d)(?=.*[@$!%*?&#^~_.\-+])[A-Za-z\d@$!%*?&#^~_.\-+]{7,}$/;
    if (!pwdRegex.test(newPassword)) {
      showSettingsFieldError(
        "inputNewPassword",
        "Mật khẩu phải từ 8 ký tự, bắt đầu bằng chữ hoa, có số và ký tự đặc biệt (@, $, !, %, *, ?, &, #, ...)!",
      );
      hasError = true;
    }
  }

  // (C) Kiểm tra Xác nhận mật khẩu mới
  if (!confirmPassword) {
    showSettingsFieldError(
      "inputConfirmPassword",
      "Vui lòng xác nhận lại mật khẩu mới!",
    );
    hasError = true;
  }

  // (D) Mật khẩu mới không được trùng mật khẩu cũ
  if (newPassword && currentPassword && newPassword === currentPassword) {
    showSettingsFieldError(
      "inputNewPassword",
      "Mật khẩu mới không được trùng với mật khẩu hiện tại!",
    );
    hasError = true;
  }

  // Dừng lại nếu có lỗi
  if (hasError) return;

  // (E) Kiểm tra 2 mật khẩu có khớp nhau không
  if (newPassword !== confirmPassword) {
    showSettingsFieldError(
      "inputConfirmPassword",
      "Xác nhận mật khẩu mới không khớp!",
    );
    hasError = true;
  }

  if (hasError) return;

  try {
    const response = await fetchWithAuth("/users/change-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });

    if (response && response.ok) {
      alert("Cập nhật mật khẩu thành công!");
      if (currentPasswordInput) currentPasswordInput.value = "";
      if (newPasswordInput) newPasswordInput.value = "";
      if (confirmPasswordInput) confirmPasswordInput.value = "";
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
      } else if (
        lower.includes("khớp") ||
        lower.includes("xác nhận") ||
        lower.includes("confirm")
      ) {
        showSettingsFieldError("inputConfirmPassword", msg);
      } else if (lower.includes("mới") || lower.includes("new")) {
        showSettingsFieldError("inputNewPassword", msg);
      } else {
        showSettingsFieldError("inputCurrentPassword", msg);
      }
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật mật khẩu:", error);
    showSettingsFieldError(
      "inputCurrentPassword",
      "Có lỗi xảy ra khi cập nhật mật khẩu!",
    );
  }
}
