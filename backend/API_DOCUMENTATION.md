# 📘 VaultDrive - Backend API Documentation for Frontend Integration

Tài liệu này tổng hợp toàn bộ các API hiện có trong hệ thống **VaultDrive Backend (Spring Boot)**, dành cho nhóm **Frontend** kết nối và phát triển giao diện.

> 💡 **Hướng dẫn duy trì tài liệu:** Khi backend bổ sung API mới, vui lòng cập nhật thêm endpoint, request body và response sample vào file markdown này để phía Frontend luôn có thông tin chính xác nhất.

---

## 📌 1. Thông Tin Chung (General Info)

* **Base URL Default:** `http://localhost:8080`
* **Content-Type Mặc định:** `application/json` (trừ các API Upload / Download binary)
* **Xác thực (Authentication):** Sử dụng **Bearer Token (JWT)** gửi trong Request Header:
  ```http
  Authorization: Bearer <your_access_token>
  ```
* **Cấu trúc Response Lỗi Mặc định (Global Exception Handling):**
  ```json
  {
    "timestamp": "2026-09-29T09:40:00",
    "status": 400,
    "error": "Bad Request",
    "message": "Thông báo lỗi chi tiết ở đây",
    "path": "/api/..."
  }
  ```

---

## 🗂️ 2. Danh Mục Các Nhóm API (API Index)

1. [🔑 Authentication (`/api/auth`)](#-1-authentication-apiauth)
2. [👤 User Profile (`/api/users`)](#-2-user-profile-apiusers)
3. [📁 Dashboard & Folders (`/api/folders`, `/api/dashboard`)](#-3-dashboard--folders-apifolders-apidashboard)
4. [📄 File Management (`/api/files`)](#-4-file-management-apifiles)
5. [📤 Resumable Chunk Upload (`/api/uploads`)](#-5-resumable-chunk-upload-apiuploads)
6. [🗑️ Trash / Thùng Rác (`/api/trash`, `/api/folders/...`, `/api/files/...`)](#-6-trash--th%C3%B9ng-r%C3%A1c-apitrash-apifolders-apifiles)
7. [🤝 Direct Sharing (`/api/shares`)](#-7-direct-sharing-apishares)
8. [🔗 Share Links Management (`/api/share-links`)](#-8-share-links-management-apishare-links)
9. [🌐 Public Share Links (`/api/public/share-links`)](#-9-public-share-links-apipublicshare-links)
10. [🔔 Notifications (`/api/notifications`)](#-10-notifications-apinotifications)

---

## 🔑 1. Authentication (`/api/auth`)

### 1.1 Đăng ký tài khoản
* **Endpoint:** `POST /api/auth/register`
* **Auth:** Không yêu cầu (Public)
* **Request Body:**
  ```json
  {
    "username": "user123",
    "email": "user@example.com",
    "password": "Password123!",
    "fullName": "Nguyễn Văn A"
  }
  ```
* **Response `200 OK`:**
  ```json
  {
    "message": "Đăng ký thành công!"
  }
  ```

### 1.2 Đăng nhập
* **Endpoint:** `POST /api/auth/login`
* **Auth:** Không yêu cầu (Public)
* **Request Body:**
  ```json
  {
    "username": "user123", // Hoặc email
    "password": "Password123!"
  }
  ```
* **Response `200 OK`:**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "email": "user@example.com",
    "role": "ROLE_USER"
  }
  ```

---

## 👤 2. User Profile (`/api/users`)

### 2.1 Lấy thông tin cá nhân hiện tại
* **Endpoint:** `GET /api/users/me`
* **Auth:** `Bearer Token`
* **Response `200 OK`:**
  ```json
  {
    "id": 1,
    "username": "user123",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "avatarUrl": "https://example.com/avatar.jpg",
    "storageUsed": 1048576,
    "storageQuota": 10737418240,
    "role": "ROLE_USER",
    "createdAt": "2026-01-01T10:00:00"
  }
  ```

### 2.2 Cập nhật thông tin cá nhân
* **Endpoint:** `PUT /api/users/me`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "fullName": "Nguyễn Văn B",
    "avatarUrl": "https://example.com/new-avatar.jpg"
  }
  ```
* **Response `200 OK`:** `UserProfileResponse` (như 2.1)

### 2.3 Đổi mật khẩu
* **Endpoint:** `PUT /api/users/change-password`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "oldPassword": "Password123!",
    "newPassword": "NewPassword123!",
    "confirmPassword": "NewPassword123!"
  }
  ```
* **Response `200 OK`:**
  ```json
  {
    "message": "Cập nhật mật khẩu thành công!"
  }
  ```

---

## 📁 3. Dashboard & Folders (`/api/folders`, `/api/dashboard`)

### 3.1 Thống kê dung lượng lưu trữ (Storage Info)
* **Endpoint:** `GET /api/dashboard/storage`
* **Auth:** `Bearer Token`
* **Response `200 OK`:**
  ```json
  {
    "usedBytes": 52428800,
    "quotaBytes": 10737418240,
    "usedPercentage": 0.49,
    "fileCount": 12,
    "folderCount": 3
  }
  ```

### 3.2 Lấy danh sách tệp/thư mục thư mục gốc (Root)
* **Endpoint:** `GET /api/folders/root`
* **Auth:** `Bearer Token`
* **Response `200 OK`:**
  ```json
  {
    "currentFolder": null,
    "breadcrumbs": [],
    "folders": [
      {
        "id": 10,
        "name": "Tài liệu học tập",
        "parentId": null,
        "userId": 1,
        "userEmail": "user@example.com",
        "createdAt": "2026-02-10T14:30:00",
        "updatedAt": "2026-02-10T14:30:00",
        "isShared": false,
        "permission": "OWNER"
      }
    ],
    "files": [
      {
        "id": 101,
        "fileName": "baocao.pdf",
        "originalName": "Báo cáo cuối kỳ.pdf",
        "fileType": "application/pdf",
        "sizeBytes": 2048576,
        "filePath": "uploads/101_baocao.pdf",
        "folderId": null,
        "userId": 1,
        "userEmail": "user@example.com",
        "createdAt": "2026-02-11T09:00:00",
        "updatedAt": "2026-02-11T09:00:00",
        "isShared": false,
        "permission": "OWNER"
      }
    ]
  }
  ```

### 3.3 Lấy nội dung chi tiết một thư mục (Child Folder)
* **Endpoint:** `GET /api/folders/{id}/contents`
* **Auth:** `Bearer Token`
* **Path Variable:** `id` (ID của thư mục)
* **Response `200 OK`:** `DashboardResponse` (Bao gồm `currentFolder`, chuỗi `breadcrumbs`, danh sách `folders` con và `files` bên trong).

### 3.4 Cây thư mục (Folder Tree)
* **Endpoint:** `GET /api/folders/tree`
* **Auth:** `Bearer Token`
* **Response `200 OK`:**
  ```json
  [
    {
      "id": 10,
      "name": "Tài liệu học tập",
      "parentId": null,
      "subFolders": [
        {
          "id": 15,
          "name": "Môn PBL4",
          "parentId": 10,
          "subFolders": []
        }
      ]
    }
  ]
  ```

### 3.5 Tải thư mục dạng tập tin ZIP
* **Endpoint:** `GET /api/folders/{id}/download`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** Binary Zip Stream (`application/octet-stream`), Header `Content-Disposition: attachment; filename="folder_name.zip"`

### 3.6 Tạo thư mục mới
* **Endpoint:** `POST /api/folders`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "name": "Thư mục mới",
    "parentId": 10 // Có thể null nếu tạo ở Root
  }
  ```
* **Response `200 OK`:** `FolderResponse`

### 3.7 Đổi tên thư mục
* **Endpoint:** `PATCH /api/folders/{id}/rename`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "name": "Tên thư mục mới"
  }
  ```
* **Response `200 OK`:** `FolderResponse`

### 3.8 Di chuyển thư mục
* **Endpoint:** `PATCH /api/folders/{id}/move`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "targetFolderId": 20 // null nếu chuyển về Root
  }
  ```
* **Response `200 OK`:** `FolderResponse`

---

## 📄 4. File Management (`/api/files`)

### 4.1 Xem trước (Preview) File
* **Endpoint:** `GET /api/files/{id}/preview`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** Stream file hiển thị inline trên trình duyệt (`Content-Disposition: inline; filename="..."`).

### 4.2 Tải xuống (Download) File
* **Endpoint:** `GET /api/files/{id}/download`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** File attachment stream (`Content-Disposition: attachment; filename="..."`).

### 4.3 Đổi tên File
* **Endpoint:** `PATCH /api/files/{id}/rename`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "name": "Tên_File_Mới.pdf"
  }
  ```
* **Response `200 OK`:** `FileItemResponse`

### 4.4 Di chuyển File
* **Endpoint:** `PATCH /api/files/{id}/move`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "targetFolderId": 15 // null nếu chuyển ra Root
  }
  ```
* **Response `200 OK`:** `FileItemResponse`

### 4.5 Upload Chunk Đơn Giản (Simple Chunk Upload)
* **Endpoint:** `POST /api/files/upload-chunk`
* **Content-Type:** `multipart/form-data`
* **Form Data:**
  * `file`: (Binary / Blob - chunk content)
  * `fileName`: "example.mp4"
  * `chunkIndex`: 0
* **Response `200 OK`:** `"Chunk 0 uploaded successfully"`

### 4.6 Gộp Chunks Đơn Giản (Simple Merge Chunks)
* **Endpoint:** `POST /api/files/merge-chunks`
* **Query Params:** `fileName` (String), `totalChunks` (int)
* **Response `200 OK`:** `"Merge task submitted successfully and processing in background"`

---

## 📤 5. Resumable Chunk Upload (`/api/uploads`)

Quy trình Upload file dung lượng lớn (có hỗ trợ Tạm dừng / Tiếp tục / Hủy):

```
1. Init Session ──> 2. Upload Chunks (Loop) ──> 3. Check Status (Optional) ──> 4. Complete Session
```

### 5.1 Khởi tạo Session Upload (`/init`)
* **Endpoint:** `POST /api/uploads/init`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "fileName": "video_demo.mp4",
    "fileSize": 104857600,
    "mimeType": "video/mp4",
    "totalChunks": 20,
    "chunkSize": 5242880,
    "folderId": 10 // Optional (null nếu upload vào Root)
  }
  ```
* **Response `200 OK`:**
  ```json
  {
    "sessionId": "a1b2c3d4-e5f6-7890",
    "fileName": "video_demo.mp4",
    "totalSizeBytes": 104857600,
    "totalChunks": 20,
    "uploadedChunksCount": 0,
    "progressPercentage": 0.0,
    "uploadedBytes": 0,
    "status": "INITIATED",
    "targetFolderId": 10,
    "createdAt": "2026-09-29T10:00:00"
  }
  ```

### 5.2 Upload từng Chunk (`/{sessionId}/chunk`)
* **Endpoint:** `POST /api/uploads/{sessionId}/chunk`
* **Auth:** `Bearer Token`
* **Content-Type:** `multipart/form-data`
* **Form / Query Params:**
  * `chunkIndex` (int): Chỉ số chunk (bắt đầu từ 0)
  * `file` (MultipartFile): Dữ liệu nhị phân của chunk
* **Response `200 OK`:** `UploadSessionResponse` (Cập nhật tiến độ `progressPercentage`, `uploadedChunksCount`).

### 5.3 Lấy trạng thái Session Upload (`/{sessionId}/status`)
* **Endpoint:** `GET /api/uploads/{sessionId}/status`
* **Auth:** `Bearer Token`
* **Response `200 OK`:**
  ```json
  {
    "sessionId": "a1b2c3d4-e5f6-7890",
    "fileName": "video_demo.mp4",
    "totalChunks": 20,
    "uploadedChunksCount": 5,
    "uploadedChunkIndexes": [0, 1, 2, 3, 4],
    "progressPercentage": 25.0,
    "status": "UPLOADING",
    "isCompleted": false,
    "isPaused": false,
    "isCancelled": false
  }
  ```

### 5.4 Tạm dừng Upload (`/{sessionId}/pause`)
* **Endpoint:** `POST /api/uploads/{sessionId}/pause`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `UploadSessionResponse` (`status`: `"PAUSED"`)

### 5.5 Tiếp tục Upload (`/{sessionId}/resume`)
* **Endpoint:** `POST /api/uploads/{sessionId}/resume`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `UploadStatusResponse` (Trả về các chunk đã upload để FE upload tiếp các chunk còn thiếu).

### 5.6 Hủy Session Upload (`/{sessionId}/cancel`)
* **Endpoint:** `POST /api/uploads/{sessionId}/cancel`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `UploadSessionResponse` (`status`: `"CANCELLED"`)

### 5.7 Hoàn tất Upload (`/{sessionId}/complete`)
* **Endpoint:** `POST /api/uploads/{sessionId}/complete`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `FileItemResponse` (Thông tin file vừa ghép hoàn chỉnh và lưu vào hệ thống).

---

## 🗑️ 6. Trash / Thùng Rác (`/api/trash`, `/api/folders/...`, `/api/files/...`)

### 6.1 Lấy danh sách item trong Thùng Rác
* **Endpoint:** `GET /api/trash`
* **Auth:** `Bearer Token`
* **Response `200 OK`:**
  ```json
  {
    "folders": [ /* Danh sách FolderResponse trong thùng rác */ ],
    "files": [ /* Danh sách FileItemResponse trong thùng rác */ ]
  }
  ```

### 6.2 Chuyển Thư mục vào Thùng Rác
* **Endpoint:** `PATCH /api/folders/{id}/trash`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Đã chuyển thư mục vào thùng rác thành công!"}`

### 6.3 Khôi phục Thư mục từ Thùng Rác
* **Endpoint:** `PATCH /api/folders/{id}/restore`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Khôi phục thư mục thành công!"}`

### 6.4 Xóa vĩnh viễn Thư mục
* **Endpoint:** `DELETE /api/folders/{id}/permanent`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Đã xóa vĩnh viễn thư mục thành công!"}`

### 6.5 Chuyển File vào Thùng Rác
* **Endpoint:** `PATCH /api/files/{id}/trash`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Đã chuyển file vào thùng rác thành công!"}`

### 6.6 Khôi phục File từ Thùng Rác
* **Endpoint:** `PATCH /api/files/{id}/restore`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Khôi phục file thành công!"}`

### 6.7 Xóa vĩnh viễn File
* **Endpoint:** `DELETE /api/files/{id}/permanent`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Đã xóa vĩnh viễn file thành công!"}`

---

## 🤝 7. Direct Sharing (`/api/shares`)

### 7.1 Chia sẻ File/Thư mục cho người dùng khác
* **Endpoint:** `POST /api/shares`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "fileId": 101, // Truyền fileId HOẶC folderId
    "folderId": null,
    "sharedWithEmail": "friend@example.com",
    "permission": "VIEW" // Hoặc "EDIT"
  }
  ```
* **Response `200 OK`:** `ShareResponse`

### 7.2 Lấy danh sách người dùng được chia sẻ một tài nguyên
* **Endpoint:** `GET /api/shares/users`
* **Auth:** `Bearer Token`
* **Query Params:** `fileId` (Long, optional), `folderId` (Long, optional)
* **Response `200 OK`:** `List<ShareResponse>`

### 7.3 Cập nhật quyền chia sẻ
* **Endpoint:** `PUT /api/shares/{shareId}`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "permission": "EDIT"
  }
  ```
* **Response `200 OK`:** `ShareResponse`

### 7.4 Thu hồi quyền chia sẻ
* **Endpoint:** `DELETE /api/shares/{shareId}`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Thu hồi quyền chia sẻ thành công!"}`

### 7.5 Lấy danh sách tệp/thư mục người khác chia sẻ với tôi
* **Endpoint:** `GET /api/shares/shared-with-me`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `List<ShareResponse>`

---

## 🔗 8. Share Links Management (`/api/share-links`)

### 8.1 Tạo link chia sẻ công khai / bảo mật
* **Endpoint:** `POST /api/share-links`
* **Auth:** `Bearer Token`
* **Request Body:**
  ```json
  {
    "fileId": 101, // Truyền fileId HOẶC folderId
    "folderId": null,
    "permission": "VIEW",
    "expiresAt": "2026-12-31T23:59:59", // Optional (null nếu không hết hạn)
    "allowDownload": true,
    "password": "secretPassword" // Optional (null nếu không đặt pass)
  }
  ```
* **Response `200 OK`:**
  ```json
  {
    "id": 1,
    "fileId": 101,
    "fileName": "baocao.pdf",
    "folderId": null,
    "folderName": null,
    "token": "abc123xyztoken",
    "publicUrl": "http://localhost:8080/api/public/share-links/abc123xyztoken",
    "expiresAt": "2026-12-31T23:59:59",
    "isActive": true,
    "createdAt": "2026-09-29T10:00:00"
  }
  ```

### 8.2 Lấy danh sách Share Links của một tài nguyên
* **Endpoint:** `GET /api/share-links`
* **Auth:** `Bearer Token`
* **Query Params:** `fileId` (Long, optional), `folderId` (Long, optional)
* **Response `200 OK`:** `List<ShareLinkResponse>`

### 8.3 Thu hồi / Vô hiệu hóa Share Link
* **Endpoint:** `DELETE /api/share-links/{id}`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Đã thu hồi / vô hiệu hóa link chia sẻ thành công!"}`

---

## 🌐 9. Public Share Links (`/api/public/share-links`)

Các API này phục vụ người dùng xem/tải nội dung qua liên kết chia sẻ mà không bắt buộc đăng nhập (Public).

### 9.1 Xem nội dung Link chia sẻ public
* **Endpoint:** `GET /api/public/share-links/{token}`
* **Auth:** Không yêu cầu (Public)
* **Query Params:** `folderId` (Long, optional - nếu truy cập vào thư mục con bên trong link public)
* **Response `200 OK`:** Chi tiết link và danh sách các tệp / thư mục con được công khai.

### 9.2 Xem trước (Preview) File Public
* **Endpoint:** `GET /api/public/share-links/{token}/preview`
* **Auth:** Không yêu cầu (Public)
* **Query Params:** `fileId` (Long, optional)
* **Response `200 OK`:** Stream file inline (`Content-Disposition: inline`)

### 9.3 Tải xuống (Download) File Public
* **Endpoint:** `GET /api/public/share-links/{token}/download`
* **Auth:** Không yêu cầu (Public)
* **Query Params:** `fileId` (Long, optional)
* **Response `200 OK`:** Stream file attachment (`Content-Disposition: attachment`)

---

## 🔔 10. Notifications (`/api/notifications`)

### 10.1 Lấy danh sách thông báo của người dùng
* **Endpoint:** `GET /api/notifications`
* **Auth:** `Bearer Token`
* **Response `200 OK`:**
  ```json
  [
    {
      "id": 1,
      "message": "User B đã chia sẻ thư mục 'Dự án A' với bạn.",
      "isRead": false,
      "type": "SHARE_ITEM",
      "createdAt": "2026-09-29T08:00:00"
    }
  ]
  ```

### 10.2 Đánh dấu đã đọc một thông báo
* **Endpoint:** `PATCH /api/notifications/{id}/read`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `NotificationResponse` (`isRead`: `true`)

### 10.3 Xóa thông báo
* **Endpoint:** `DELETE /api/notifications/{id}`
* **Auth:** `Bearer Token`
* **Response `200 OK`:** `{"message": "Đã xóa thông báo thành công!"}`

---

## 📝 Quy trình duy trì & Cập nhật cho Lập trình viên Backend

Mỗi khi bạn thêm một Controller hoặc Endpoint mới:
1. Xác định nhóm API phù hợp (hoặc thêm mục mới trong mục 2).
2. Viết thêm khối thông tin bao gồm:
   - Method & Endpoint Path
   - Loại Auth (Public / Bearer Token)
   - Parameters / Request Body sample
   - Response sample
3. Lưu lại file `API_DOCUMENTATION.md` này để phía Frontend luôn cập nhật kịp thời.
