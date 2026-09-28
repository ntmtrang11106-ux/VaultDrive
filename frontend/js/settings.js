// frontend/js/settings.js

function renderSettingsView() {
  const container = document.getElementById("settings-view-container");
  if (!container) return;

  container.style.display = "block";
  container.innerHTML = `
    <div class="settings-container">
      
      <!-- Profile Header -->
      <div class="settings-header-card">
        <div class="settings-profile-info">
          <div class="settings-avatar" id="settingsAvatar">TM</div>
          <div class="settings-user-details">
            <h2 id="settingsFullName">Đang tải...</h2>
            <div class="email" id="settingsEmail">...</div>
            <div class="plan-info">Gói Cá nhân &middot; 100 GB</div>
          </div>
        </div>
        <button class="btn-outline">Đổi ảnh</button>
      </div>

      <!-- Tabs -->
      <div class="settings-tabs">
        <div class="settings-tab active" id="tab-profile" onclick="switchSettingsTab('profile')">Thông tin cá nhân</div>
        <div class="settings-tab" id="tab-password" onclick="switchSettingsTab('password')">Mật khẩu</div>
      </div>

      <!-- Content Area -->
      <div class="settings-content-card" id="settings-content-profile">
        <div class="settings-content-header">
          <h3>Thông tin cá nhân</h3>
          <button class="btn-edit" id="btnEditProfile" onclick="toggleEditProfile()"><i class="ph ph-pencil-simple"></i> Chỉnh sửa</button>
        </div>

        <div class="settings-form-group">
          <label>Họ và tên</label>
          <input type="text" class="settings-form-control" id="inputFullName" disabled />
        </div>
        
        <div class="settings-form-group">
          <label>Email <span class="verified-badge">Đã xác minh</span></label>
          <input type="email" class="settings-form-control" id="inputEmail" disabled />
        </div>

        <div class="settings-form-group">
          <label>Số điện thoại</label>
          <input type="text" class="settings-form-control" id="inputPhone" disabled />
        </div>

        <div class="settings-form-group">
          <label>Ngày sinh</label>
          <input type="date" class="settings-form-control" id="inputDob" disabled />
        </div>

        <div class="settings-form-group">
          <label>Giới tính</label>
          <select class="settings-form-control" id="inputGender" disabled>
            <option value="">Chọn giới tính</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>

        <button class="btn-submit" id="btnSaveProfile" style="display: none;" onclick="saveProfile()">Lưu thay đổi</button>
      </div>

      <!-- Content Area Password -->
      <div class="settings-content-card" id="settings-content-password" style="display: none;">
        <div class="settings-content-header">
          <div>
            <h3>Đổi mật khẩu</h3>
            <p>Mật khẩu mới phải có ít nhất 8 ký tự.</p>
          </div>
        </div>

        <div class="settings-form-group">
          <label>Mật khẩu hiện tại</label>
          <div class="password-input-wrapper">
            <input type="password" class="settings-form-control" id="inputCurrentPassword" placeholder="Nhập mật khẩu hiện tại" />
            <i class="ph ph-eye password-toggle" onclick="togglePasswordVisibility('inputCurrentPassword', this)"></i>
          </div>
        </div>

        <div class="settings-form-group">
          <label>Mật khẩu mới</label>
          <div class="password-input-wrapper">
            <input type="password" class="settings-form-control" id="inputNewPassword" placeholder="Ít nhất 8 ký tự" />
            <i class="ph ph-eye password-toggle" onclick="togglePasswordVisibility('inputNewPassword', this)"></i>
          </div>
        </div>

        <div class="settings-form-group">
          <label>Xác nhận mật khẩu mới</label>
          <div class="password-input-wrapper">
            <input type="password" class="settings-form-control" id="inputConfirmPassword" placeholder="Nhập lại mật khẩu mới" />
            <i class="ph ph-eye password-toggle" onclick="togglePasswordVisibility('inputConfirmPassword', this)"></i>
          </div>
        </div>

        <button class="btn-submit" onclick="savePassword()">Cập nhật mật khẩu</button>
      </div>

    </div>
  `;

  loadUserProfile();
}

function switchSettingsTab(tab) {
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
    btnSave.style.display = "block";
    document.getElementById("inputFullName").focus();
  } else {
    btnEdit.innerHTML = `<i class="ph ph-pencil-simple"></i> Chỉnh sửa`;
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

async function savePassword() {
  const currentPassword = document.getElementById("inputCurrentPassword").value;
  const newPassword = document.getElementById("inputNewPassword").value;
  const confirmPassword = document.getElementById("inputConfirmPassword").value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    alert("Vui lòng điền đầy đủ các trường!");
    return;
  }
  if (newPassword.length < 8) {
    alert("Mật khẩu mới phải có ít nhất 8 ký tự!");
    return;
  }
  if (newPassword !== confirmPassword) {
    alert("Xác nhận mật khẩu mới không khớp!");
    return;
  }

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
    } else {
      const errData = await response.json().catch(() => ({}));
      alert(errData.message || "Cập nhật mật khẩu thất bại!");
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật mật khẩu:", error);
    alert("Có lỗi xảy ra khi cập nhật mật khẩu!");
  }
}
