// Cấu hình đường dẫn gốc đến Backend API của phần đăng nhập/đăng ký
const API_BASE_URL = "http://localhost:8080/api/auth";

// Hàm bật/tắt hiển thị mật khẩu (Icon con mắt)
function togglePasswordVisibility(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    if (iconEl) {
      iconEl.classList.remove("ph-eye");
      iconEl.classList.add("ph-eye-slash");
    }
  } else {
    input.type = "password";
    if (iconEl) {
      iconEl.classList.remove("ph-eye-slash");
      iconEl.classList.add("ph-eye");
    }
  }
}

// Sự kiện DOMContentLoaded đảm bảo toàn bộ HTML đã được tải xong mới chạy Javascript
document.addEventListener("DOMContentLoaded", () => {
  // Tự động chuyển thẳng vào Dashboard nếu trình duyệt đã có tài khoản đang đăng nhập
  const currentToken = localStorage.getItem("jwt_token");
  const isAuthPage =
    window.location.pathname.endsWith("login.html") ||
    window.location.pathname.endsWith("register.html");
  if (currentToken && isAuthPage) {
    const role = localStorage.getItem("user_role");
    window.location.replace(
      role === "ROLE_ADMIN" ? "dashboard.html?tab=soc" : "dashboard.html",
    );
    return;
  }

  // Nếu đang mở trang login/register mà một tab khác vừa đăng nhập thành công -> tự động vào Dashboard luôn
  window.addEventListener("storage", (e) => {
    if (e.key === "jwt_token" && e.newValue && isAuthPage) {
      const role = localStorage.getItem("user_role");
      window.location.replace(
        role === "ROLE_ADMIN" ? "dashboard.html?tab=soc" : "dashboard.html",
      );
    }
  });

  // ==========================================
  // 1. XỬ LÝ CHỨC NĂNG ĐĂNG NHẬP (LOGIN)
  // ==========================================
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const errorEl = document.getElementById("errorMessage");
      const btn = document.getElementById("loginBtn");

      // Xóa tất cả các thông báo lỗi cũ trên form
      clearErrors(loginForm);

      // Ngăn chặn đăng nhập tài khoản khác khi trên trình duyệt đang có tài khoản hoạt động
      const activeToken = localStorage.getItem("jwt_token");
      const activeEmail = localStorage.getItem("user_email");
      if (
        activeToken &&
        activeEmail &&
        email &&
        activeEmail.toLowerCase() !== email.trim().toLowerCase()
      ) {
        errorEl.textContent = `Trình duyệt đang đăng nhập tài khoản "${activeEmail}". Vui lòng đăng xuất trước khi đăng nhập tài khoản khác!`;
        errorEl.style.display = "block";
        return;
      }

      setLoading(btn, true);

      let hasError = false;
      if (!email) {
        showFieldError("email", "Vui lòng nhập địa chỉ email!");
        hasError = true;
      }
      if (!password) {
        showFieldError("password", "Vui lòng nhập mật khẩu!");
        hasError = true;
      }
      if (hasError) {
        setLoading(btn, false);
        return;
      }

      try {
        // Gửi HTTP POST request đến Backend API để đăng nhập
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password }),
        });

        // Nếu API trả về mã lỗi (không phải 2xx), ném ra lỗi để catch xử lý
        if (!response.ok) {
          throw new Error("Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
        }

        const data = await response.json();

        // Lưu token và role thực tế từ backend trả về
        localStorage.setItem("jwt_token", data.accessToken);
        localStorage.setItem("user_role", data.role);
        if (data.email) {
          localStorage.setItem("user_email", data.email);
        }
        if (data.fullName || data.name) {
          localStorage.setItem("user_fullname", data.fullName || data.name);
          localStorage.setItem(
            "mock_user_profile",
            JSON.stringify({
              fullName: data.fullName || data.name,
              email: data.email || email,
            }),
          );
        }

        // Kiểm tra quyền (role) để chuyển hướng
        if (data.role === "ROLE_ADMIN") {
          // Chuyển vào khung dashboard.html và mở thẳng tab SOC
          // window.location.href = "dashboard.html";
          window.location.href = "dashboard.html?tab=soc";
        } else {
          // Trang dành cho user
          window.location.href = "dashboard.html";
        }
      } catch (err) {
        // Nếu có lỗi xảy ra (do try/catch hoặc mất mạng), hiển thị thông báo lỗi màu đỏ
        errorEl.textContent = err.message || "Sai thông tin đăng nhập";
        errorEl.style.display = "block";
      } finally {
        // Tắt hiệu ứng loading dù thành công hay thất bại
        setLoading(btn, false);
      }
    });
  }

  // ==========================================
  // 2. XỬ LÝ CHỨC NĂNG ĐĂNG KÝ (REGISTER)
  // ==========================================
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    const fullnameInput = document.getElementById("fullname");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const dobInput = document.getElementById("dob");
    const genderInput = document.getElementById("gender");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const errorEl = document.getElementById("errorMessage");
    const successEl = document.getElementById("successMessage");
    const btn = document.getElementById("registerBtn");

    // Khóa ngày trong tương lai ngay trên lịch của trình duyệt
    if (dobInput) {
      dobInput.max = new Date().toISOString().split("T")[0];
    }

    // (1) Kiểm tra Họ và tên
    function validateFullname() {
      if (!fullnameInput) return true;
      const val = fullnameInput.value.trim();
      if (!val) {
        showFieldError("fullname", "Vui lòng nhập họ và tên!");
        return false;
      }
      if (val.length < 2) {
        showFieldError("fullname", "Họ và tên phải có ít nhất 2 ký tự!");
        return false;
      }
      clearFieldError("fullname");
      return true;
    }

    // Hàm gọi thử API để kiểm tra xem Email đã có người dùng đăng ký chưa (không thay đổi backend)
    async function checkEmailExists(email) {
      if (!email) return false;
      try {
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password: null }),
        });
        if (!response.ok) {
          const text = await response.text();
          if (text.includes("Email đã được sử dụng")) {
            return true;
          }
        }
      } catch (_) {}
      return false;
    }

    // (2) Kiểm tra Email ngay khi out ô nhập
    async function validateEmail() {
      if (!emailInput) return true;
      const val = emailInput.value.trim();
      if (!val) {
        showFieldError("email", "Vui lòng nhập địa chỉ email!");
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        showFieldError("email", "Địa chỉ email không đúng định dạng!");
        return false;
      }
      // Kiểm tra thực tế xem Email đã được dùng chưa
      const isUsed = await checkEmailExists(val);
      if (isUsed) {
        showFieldError("email", "Email đã được sử dụng!");
        return false;
      }
      clearFieldError("email");
      return true;
    }

    // Hàm kiểm tra xem Số điện thoại đã được dùng chưa
    function checkPhoneExists(phone) {
      const clean = (phone || "").trim();
      const defaultUsed = [
        "0766516287",
        "0914111222",
        "0905123456",
        "0987654321",
      ];
      let usedList = defaultUsed;
      try {
        const saved = JSON.parse(localStorage.getItem("used_phones") || "null");
        if (Array.isArray(saved)) {
          usedList = Array.from(new Set([...defaultUsed, ...saved]));
        }
      } catch (_) {}
      return usedList.includes(clean);
    }

    // (3) Kiểm tra Số điện thoại ngay khi out ô nhập
    function validatePhone() {
      if (!phoneInput) return true;
      const val = phoneInput.value.trim();
      if (!val) {
        showFieldError("phone", "Vui lòng nhập số điện thoại!");
        return false;
      }
      const phoneRegex = /^0\d{9}$/;
      if (!phoneRegex.test(val)) {
        showFieldError(
          "phone",
          "Số điện thoại không hợp lệ (phải đúng 10 chữ số và bắt đầu bằng số 0)!",
        );
        return false;
      }
      if (checkPhoneExists(val)) {
        showFieldError("phone", "Số điện thoại đã được sử dụng!");
        return false;
      }
      clearFieldError("phone");
      return true;
    }

    // (4) Kiểm tra Ngày sinh (không được ở tương lai)
    function validateDob() {
      if (!dobInput) return true;
      const val = dobInput.value;
      if (!val) {
        showFieldError("dob", "Vui lòng chọn ngày sinh!");
        return false;
      }
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        showFieldError(
          "dob",
          "Ngày sinh không hợp lệ (không thể chọn ngày trong tương lai)!",
        );
        return false;
      }
      clearFieldError("dob");
      return true;
    }

    // (5) Kiểm tra Giới tính
    function validateGender() {
      if (!genderInput) return true;
      const val = genderInput.value;
      if (!val) {
        showFieldError("gender", "Vui lòng chọn giới tính!");
        return false;
      }
      clearFieldError("gender");
      return true;
    }

    // (6) Kiểm tra Mật khẩu ngay khi out ô nhập
    function validatePassword() {
      if (!passwordInput) return true;
      const val = passwordInput.value;
      if (!val) {
        showFieldError("password", "Vui lòng tạo mật khẩu!");
        return false;
      }
      const pwdRegex =
        /^[A-Z](?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{7,}$/;
      if (!pwdRegex.test(val)) {
        showFieldError(
          "password",
          "Mật khẩu phải từ 8 ký tự, bắt đầu bằng chữ hoa, có số và ký tự đặc biệt.",
        );
        return false;
      }
      clearFieldError("password");
      // Nếu ô xác nhận mật khẩu đã nhập rồi thì kiểm tra khớp lại
      if (confirmPasswordInput && confirmPasswordInput.value) {
        validateConfirmPassword();
      }
      return true;
    }

    // (7) Kiểm tra Xác nhận mật khẩu ngay khi out ô nhập
    function validateConfirmPassword() {
      if (!confirmPasswordInput) return true;
      const pVal = passwordInput ? passwordInput.value : "";
      const cpVal = confirmPasswordInput.value;
      if (!cpVal) {
        showFieldError("confirmPassword", "Vui lòng xác nhận mật khẩu!");
        return false;
      }
      if (pVal !== cpVal) {
        showFieldError("confirmPassword", "Mật khẩu xác nhận không khớp!");
        return false;
      }
      clearFieldError("confirmPassword");
      return true;
    }

    // Gắn sự kiện blur (ngay khi click hoặc tab ra ngoài ô nhập) và change
    if (fullnameInput) fullnameInput.addEventListener("blur", validateFullname);
    if (emailInput) emailInput.addEventListener("blur", validateEmail);
    if (phoneInput) phoneInput.addEventListener("blur", validatePhone);
    if (dobInput) {
      dobInput.addEventListener("blur", validateDob);
      dobInput.addEventListener("change", validateDob);
    }
    if (genderInput) {
      genderInput.addEventListener("blur", validateGender);
      genderInput.addEventListener("change", validateGender);
    }
    if (passwordInput) passwordInput.addEventListener("blur", validatePassword);
    if (confirmPasswordInput)
      confirmPasswordInput.addEventListener("blur", validateConfirmPassword);

    // Khi người dùng bấm nút Submit "Tạo tài khoản"
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullname = fullnameInput ? fullnameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const phone = phoneInput ? phoneInput.value.trim() : "";
      const dob = dobInput ? dobInput.value : "";
      const gender = genderInput ? genderInput.value : "";
      const password = passwordInput ? passwordInput.value : "";
      const confirmPassword = confirmPasswordInput
        ? confirmPasswordInput.value
        : "";

      // Xóa tất cả các thông báo lỗi cũ hiển thị trên form
      clearErrors(registerForm);
      successEl.style.display = "none";

      // Chạy kiểm tra toàn bộ form đồng thời
      const vName = validateFullname();
      const vEmail = await validateEmail();
      const vPhone = validatePhone();
      const vDob = validateDob();
      const vGender = validateGender();
      const vPwd = validatePassword();
      const vConfirm = validateConfirmPassword();

      if (
        !vName ||
        !vEmail ||
        !vPhone ||
        !vDob ||
        !vGender ||
        !vPwd ||
        !vConfirm
      ) {
        return;
      }

      // Bật trạng thái đang xử lý (loading)
      setLoading(btn, true);

      try {
        // Gọi API để gửi thông tin đăng ký lên Server
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
            fullName: fullname,
            phone: phone,
            dob: dob,
            gender: gender ? gender.toUpperCase() : "",
            password: password,
          }),
        });

        if (!response.ok) {
          let errData = null;
          let errMsg = "";
          try {
            errData = await response.json();
            errMsg = errData.message || errData.error || "";
          } catch (_) {
            try {
              errMsg = await response.text();
            } catch (_) {}
          }

          // Trích xuất chuỗi thông báo nếu errMsg vẫn là chuỗi JSON
          if (typeof errMsg === "string" && errMsg.startsWith("{")) {
            try {
              const parsed = JSON.parse(errMsg);
              errMsg = parsed.message || parsed.error || errMsg;
            } catch (_) {}
          }

          const lowerMsg = (errMsg || "").toLowerCase();
          let handledField = false;

          // 1. Phân tích nếu Backend trả về danh sách lỗi theo từng trường (Validation errors map)
          if (
            errData &&
            typeof errData.errors === "object" &&
            errData.errors !== null
          ) {
            Object.keys(errData.errors).forEach((fKey) => {
              const fieldId = fKey.toLowerCase();
              const fMsg = errData.errors[fKey];
              if (document.getElementById(fieldId + "Error")) {
                showFieldError(fieldId, fMsg);
                handledField = true;
              } else if (fieldId === "fullname" || fieldId === "name") {
                showFieldError("fullname", fMsg);
                handledField = true;
              }
            });
          }

          // 2. Nhận diện theo từ khóa trong thông báo lỗi để hiển thị dưới ô nhập tương ứng
          if (!handledField && errMsg) {
            if (lowerMsg.includes("email")) {
              showFieldError("email", errMsg);
              handledField = true;
            } else if (
              lowerMsg.includes("phone") ||
              lowerMsg.includes("thoại") ||
              lowerMsg.includes("số điện thoại")
            ) {
              showFieldError("phone", errMsg);
              handledField = true;
            } else if (
              lowerMsg.includes("password") ||
              lowerMsg.includes("mật khẩu")
            ) {
              showFieldError("password", errMsg);
              handledField = true;
            } else if (
              lowerMsg.includes("name") ||
              lowerMsg.includes("tên") ||
              lowerMsg.includes("họ")
            ) {
              showFieldError("fullname", errMsg);
              handledField = true;
            } else if (
              lowerMsg.includes("dob") ||
              lowerMsg.includes("ngày sinh")
            ) {
              showFieldError("dob", errMsg);
              handledField = true;
            } else if (
              lowerMsg.includes("gender") ||
              lowerMsg.includes("giới tính")
            ) {
              showFieldError("gender", errMsg);
              handledField = true;
            }
          }

          // 3. Nếu không map được vào ô nhập nào thì mới hiện ở khung thông báo chung
          if (!handledField) {
            errorEl.textContent =
              errMsg || "Đăng ký thất bại. Vui lòng thử lại!";
            errorEl.style.display = "block";
          }
          return;
        }

        // Đăng ký thành công, tự động đăng nhập
        const loginResponse = await fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password }),
        });

        if (!loginResponse.ok) {
          throw new Error(
            "Đăng ký thành công nhưng đăng nhập tự động thất bại. Vui lòng thử đăng nhập thủ công.",
          );
        }

        const data = await loginResponse.json();

        // Lưu thông tin đăng nhập
        localStorage.setItem("jwt_token", data.accessToken);
        localStorage.setItem("user_role", data.role);
        if (data.email) {
          localStorage.setItem("user_email", data.email);
        }
        if (fullname) {
          localStorage.setItem("user_fullname", fullname);
          localStorage.setItem(
            "mock_user_profile",
            JSON.stringify({
              fullName: fullname,
              email: data.email || email,
              phone: phone,
              dob: dob,
              gender: gender ? gender.toUpperCase() : "",
            }),
          );
        }

        // Thông báo và chuyển hướng trực tiếp vào trang dashboard
        successEl.textContent = "Đăng ký thành công! Đang vào hệ thống...";
        successEl.style.display = "block";

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 100);
      } catch (err) {
        let msg = err.message || "Có lỗi xảy ra, vui lòng thử lại.";
        if (typeof msg === "string" && msg.startsWith("{")) {
          try {
            const parsed = JSON.parse(msg);
            msg = parsed.message || parsed.error || msg;
          } catch (_) {}
        }
        const lowerMsg = (msg || "").toLowerCase();
        if (lowerMsg.includes("email")) {
          showFieldError("email", msg);
        } else if (lowerMsg.includes("phone") || lowerMsg.includes("thoại")) {
          showFieldError("phone", msg);
        } else if (lowerMsg.includes("password") || lowerMsg.includes("mật khẩu")) {
          showFieldError("password", msg);
        } else {
          errorEl.textContent = msg;
          errorEl.style.display = "block";
        }
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ==========================================
  // 3. XỬ LÝ QUÊN MẬT KHẨU (FORGOT PASSWORD)
  // ==========================================
  const forgotForm = document.getElementById("forgotPasswordForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const errorEl = document.getElementById("errorMessage");
      const successEl = document.getElementById("successMessage");
      const btn = document.getElementById("forgotBtn");

      clearErrors(forgotForm);
      successEl.style.display = "none";

      if (!email) {
        showFieldError("email", "Vui lòng nhập địa chỉ email!");
        return;
      }

      setLoading(btn, true);
      try {
        // Giả lập gọi API thành công (bạn sẽ thay bằng fetch thực tế sau)
        await new Promise((r) => setTimeout(r, 1000));
        successEl.textContent =
          "Liên kết khôi phục đã được gửi đến email của bạn.";
        successEl.style.display = "block";
      } catch (err) {
        errorEl.textContent = "Có lỗi xảy ra, vui lòng thử lại.";
        errorEl.style.display = "block";
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ==========================================
  // 4. XỬ LÝ ĐẶT LẠI MẬT KHẨU (RESET PASSWORD)
  // ==========================================
  const resetForm = document.getElementById("resetPasswordForm");
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const errorEl = document.getElementById("errorMessage");
      const successEl = document.getElementById("successMessage");
      const btn = document.getElementById("resetBtn");

      clearErrors(resetForm);
      successEl.style.display = "none";

      let hasError = false;
      if (!password) {
        showFieldError("password", "Vui lòng nhập mật khẩu mới!");
        hasError = true;
      }
      if (!confirmPassword) {
        showFieldError("confirmPassword", "Vui lòng xác nhận mật khẩu mới!");
        hasError = true;
      }
      if (hasError) return;

      const pwdRegex = /^[A-Z](?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{7,}$/;
      if (!pwdRegex.test(password)) {
        showFieldError(
          "password",
          "Mật khẩu phải từ 8 ký tự, bắt đầu bằng chữ hoa, có số và ký tự đặc biệt.",
        );
        hasError = true;
      }
      if (password !== confirmPassword) {
        showFieldError("confirmPassword", "Mật khẩu xác nhận không khớp!");
        hasError = true;
      }
      if (hasError) return;

      setLoading(btn, true);
      try {
        // Giả lập gọi API thành công
        await new Promise((r) => setTimeout(r, 1000));
        successEl.textContent = "Đổi mật khẩu thành công! Đang chuyển hướng...";
        successEl.style.display = "block";
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
      } catch (err) {
        errorEl.textContent = "Có lỗi xảy ra, vui lòng thử lại.";
        errorEl.style.display = "block";
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ==========================================
  // 5. HÀM HỖ TRỢ (UTILITIES)
  // ==========================================
  // Hàm này giúp bật/tắt icon quay vòng tròn trên nút bấm, và vô hiệu hóa nút để tránh người dùng nhấn 2 lần
  function setLoading(btnElement, isLoading) {
    if (isLoading) {
      btnElement.classList.add("loading");
      btnElement.disabled = true;
    } else {
      btnElement.classList.remove("loading");
      btnElement.disabled = false;
    }
  }

  // Hàm xóa tất cả thông báo lỗi (inline và toàn cục)
  function clearErrors(formElement) {
    formElement.querySelectorAll(".field-error").forEach((el) => {
      el.style.display = "none";
      el.textContent = "";
    });
    formElement
      .querySelectorAll(".input-error")
      .forEach((el) => el.classList.remove("input-error"));
    const globalError = formElement.querySelector(".error-message");
    if (globalError) {
      globalError.style.display = "none";
      globalError.textContent = "";
    }
  }

  // Hàm hiển thị lỗi ngay dưới ô nhập liệu
  function showFieldError(inputId, message) {
    const inputElement = document.getElementById(inputId);
    const errorElement = document.getElementById(inputId + "Error");
    if (inputElement) {
      inputElement.classList.add("input-error");
    }
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "block";
    }
  }

  // Hàm xóa lỗi của một ô nhập cụ thể
  function clearFieldError(inputId) {
    const inputElement = document.getElementById(inputId);
    const errorElement = document.getElementById(inputId + "Error");
    if (inputElement) {
      inputElement.classList.remove("input-error");
    }
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
    }
  }

  // Tự động ẩn lỗi khi người dùng bắt đầu gõ vào ô nhập
  document
    .querySelectorAll(".auth-form input, .auth-form select")
    .forEach((input) => {
      input.addEventListener("input", function () {
        // Xóa class viền đỏ
        this.classList.remove("input-error");

        // Ẩn thông báo chữ đỏ bên dưới
        const errorElement = document.getElementById(this.id + "Error");
        if (errorElement) {
          errorElement.style.display = "none";
          errorElement.textContent = "";
        }

        // Ẩn luôn thông báo lỗi chung nếu có
        const globalError =
          this.closest("form").querySelector(".error-message");
        if (globalError) {
          globalError.style.display = "none";
          globalError.textContent = "";
        }
      });
    });
});
