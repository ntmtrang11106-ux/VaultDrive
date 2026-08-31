// Cấu hình đường dẫn gốc đến Backend API của phần đăng nhập/đăng ký
const API_BASE_URL = "/api/auth";

// Sự kiện DOMContentLoaded đảm bảo toàn bộ HTML đã được tải xong mới chạy Javascript
document.addEventListener("DOMContentLoaded", () => {
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
          body: JSON.stringify({ email, password }), // Đóng gói dữ liệu dạng JSON
        });

        // Nếu API trả về mã lỗi (không phải 2xx), ném ra lỗi để catch xử lý
        if (!response.ok) {
          throw new Error("Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
        }

        const data = await response.json();

        // Lưu token bảo mật và thông tin người dùng vào Local Storage của trình duyệt
        localStorage.setItem("jwt_token", data.token);
        localStorage.setItem("user_role", data.role);
        localStorage.setItem("email", email);

        // Kiểm tra quyền (role) để chuyển hướng đến trang phù hợp
        if (data.role === "ROLE_ADMIN") {
          window.location.href = "/dashboard";
        } else {
          window.location.href = "/my-files";
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
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullname = document.getElementById("fullname").value;
      const email = document.getElementById("email").value;
      const phone = document.getElementById("phone").value;
      const dob = document.getElementById("dob").value;
      const gender = document.getElementById("gender").value;
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const errorEl = document.getElementById("errorMessage");
      const successEl = document.getElementById("successMessage");
      const btn = document.getElementById("registerBtn");

      // Xóa tất cả các lỗi cũ hiển thị trên form
      clearErrors(registerForm);
      successEl.style.display = "none";

      let hasError = false;

      // (A) Kiểm tra rỗng từng trường và báo lỗi ngay dưới ô nhập
      if (!fullname) {
        showFieldError("fullname", "Vui lòng nhập họ và tên!");
        hasError = true;
      }
      if (!email) {
        showFieldError("email", "Vui lòng nhập địa chỉ email!");
        hasError = true;
      }
      if (!phone) {
        showFieldError("phone", "Vui lòng nhập số điện thoại!");
        hasError = true;
      }
      if (!dob) {
        showFieldError("dob", "Vui lòng chọn ngày sinh!");
        hasError = true;
      }
      if (!gender) {
        showFieldError("gender", "Vui lòng chọn giới tính!");
        hasError = true;
      }
      if (!password) {
        showFieldError("password", "Vui lòng tạo mật khẩu!");
        hasError = true;
      }
      if (!confirmPassword) {
        showFieldError("confirmPassword", "Vui lòng xác nhận mật khẩu!");
        hasError = true;
      }

      // Nếu có ô nào trống thì dừng lại
      if (hasError) return;

      // (B) Kiểm tra định dạng số điện thoại (đúng 10 chữ số, không chứa ký tự khác)
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phone)) {
        showFieldError(
          "phone",
          "Số điện thoại không hợp lệ (phải đúng 10 chữ số).",
        );
        hasError = true;
      }

      // (C) Kiểm tra tính hợp lệ của mật khẩu bằng Biểu thức chính quy (Regex)
      const pwdRegex = /^[A-Z](?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{7,}$/;
      if (!pwdRegex.test(password)) {
        showFieldError(
          "password",
          "Mật khẩu phải từ 8 ký tự, bắt đầu bằng chữ hoa, có số và ký tự đặc biệt.",
        );
        hasError = true;
      }

      // (D) Kiểm tra xác nhận mật khẩu có khớp không
      if (password !== confirmPassword) {
        showFieldError("confirmPassword", "Mật khẩu xác nhận không khớp!");
        hasError = true;
      }

      // Nếu có lỗi định dạng thì dừng lại
      if (hasError) return;

      // Bật trạng thái đang xử lý (loading)
      setLoading(btn, true);

      try {
        // Gọi API để gửi thông tin đăng ký lên Server
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullname,
            email,
            phone,
            dob,
            gender,
            password,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            text || "Đăng ký thất bại. Email có thể đã được sử dụng.",
          );
        }

        // Nếu đăng ký thành công, báo xanh và đếm ngược chuyển sang trang Đăng nhập
        successEl.textContent =
          "Đăng ký thành công! Đang chuyển hướng đến trang đăng nhập...";
        successEl.style.display = "block";

        setTimeout(() => {
          window.location.href = "login.html"; // Chuyển trang sau 2 giây
        }, 2000);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
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
