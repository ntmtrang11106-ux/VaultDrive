package com.example.vault_drive;

import com.example.vault_drive.dto.*;
import com.example.vault_drive.entity.*;
import com.example.vault_drive.repository.*;
import com.example.vault_drive.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class BackendFeaturesIntegrationTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private UploadService uploadService;

    @Autowired
    private FileService fileService;

    @Autowired
    private ShareService shareService;

    @Autowired
    private ShareLinkService shareLinkService;

    @Autowired
    private TrashService trashService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private FileShareRepository fileShareRepository;

    @Autowired
    private ShareLinkRepository shareLinkRepository;

    @Autowired
    private UploadSessionRepository uploadSessionRepository;

    @Autowired
    private FileItemRepository fileItemRepository;

    @Autowired
    private FolderRepository folderRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StoragePlanRepository storagePlanRepository;

    @Autowired
    private UserStorageRepository userStorageRepository;

    private User user1;
    private User user2;
    private User user3;

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        fileShareRepository.deleteAll();
        shareLinkRepository.deleteAll();
        uploadSessionRepository.deleteAll();
        fileItemRepository.deleteAll();
        folderRepository.deleteAll();
        userStorageRepository.deleteAll();
        storagePlanRepository.deleteAll();
        userRepository.deleteAll();

        RegisterRequest reg1 = new RegisterRequest();
        reg1.setEmail("user1@vaultdrive.com");
        reg1.setPassword("pass123");
        reg1.setFullName("User One");

        RegisterRequest reg2 = new RegisterRequest();
        reg2.setEmail("user2@vaultdrive.com");
        reg2.setPassword("pass123");
        reg2.setFullName("User Two");

        RegisterRequest reg3 = new RegisterRequest();
        reg3.setEmail("user3@vaultdrive.com");
        reg3.setPassword("pass123");
        reg3.setFullName("User Three");

        authService.register(reg1);
        authService.register(reg2);
        authService.register(reg3);

        user1 = userRepository.findByEmail("user1@vaultdrive.com").orElseThrow();
        user2 = userRepository.findByEmail("user2@vaultdrive.com").orElseThrow();
        user3 = userRepository.findByEmail("user3@vaultdrive.com").orElseThrow();
    }

    private void authenticateAs(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user.getEmail(), null, List.of()
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    void test1_DashboardAndStorageManagement() {
        authenticateAs(user1);

        // Check initial storage
        StorageInfoResponse storageInfo = dashboardService.getStorageInfo(user1);
        assertNotNull(storageInfo);
        assertEquals(0L, storageInfo.getUsedBytes());
        assertTrue(storageInfo.getMaxBytes() > 0);

        // Check root dashboard
        DashboardResponse root = dashboardService.getRootDashboard(user1);
        assertNotNull(root);
        assertTrue(root.getSubfolders().isEmpty());
        assertTrue(root.getFiles().isEmpty());

        // Create Subfolder
        FolderCreateRequest createReq = new FolderCreateRequest("Documents", null);
        FolderResponse folder1 = dashboardService.createFolder(user1, createReq);
        assertNotNull(folder1);
        assertEquals("Documents", folder1.getName());

        // Create Subfolder inside Documents
        FolderCreateRequest subReq = new FolderCreateRequest("Projects", folder1.getId());
        FolderResponse folder2 = dashboardService.createFolder(user1, subReq);
        assertEquals("Projects", folder2.getName());
        assertEquals(folder1.getId(), folder2.getParentId());

        // Check Folder Tree
        List<FolderTreeResponse> tree = dashboardService.getFolderTree(user1);
        assertEquals(1, tree.size());
        assertEquals("Documents", tree.get(0).getName());
        assertEquals(1, tree.get(0).getChildren().size());
        assertEquals("Projects", tree.get(0).getChildren().get(0).getName());
    }

    @Test
    void test2_ChunkedUploadFlowAndQuotaCheck() {
        authenticateAs(user1);

        // 1. Init Upload Session
        UploadInitRequest initReq = new UploadInitRequest("test_file.txt", 100L, 2, null);
        UploadSessionResponse sessionResp = uploadService.initUploadSession(user1, initReq);
        assertNotNull(sessionResp);
        assertEquals("test_file.txt", sessionResp.getFileName());
        assertEquals("UPLOADING", sessionResp.getStatus());
        assertEquals(2, sessionResp.getTotalChunks());

        String sessionId = sessionResp.getSessionId();

        // 2. Upload Chunk 0
        MockMultipartFile chunk0 = new MockMultipartFile("file", "chunk0.part", "text/plain", "Hello ".getBytes(StandardCharsets.UTF_8));
        UploadSessionResponse chunk0Resp = uploadService.uploadChunk(user1, sessionId, 0, chunk0);
        assertEquals(1, chunk0Resp.getUploadedChunksCount());

        // Retry uploading Chunk 0 (Idempotency Check)
        UploadSessionResponse retry0Resp = uploadService.uploadChunk(user1, sessionId, 0, chunk0);
        assertEquals(1, retry0Resp.getUploadedChunksCount());

        // 3. Upload Chunk 1
        MockMultipartFile chunk1 = new MockMultipartFile("file", "chunk1.part", "text/plain", "World!".getBytes(StandardCharsets.UTF_8));
        UploadSessionResponse chunk1Resp = uploadService.uploadChunk(user1, sessionId, 1, chunk1);
        assertEquals(2, chunk1Resp.getUploadedChunksCount());

        // 4. Status Check
        UploadStatusResponse status = uploadService.getSessionStatus(user1, sessionId);
        assertTrue(status.getRemainingChunks().isEmpty());

        // 5. Complete Upload Session
        FileItemResponse completedFile = uploadService.completeUploadSession(user1, sessionId);
        assertNotNull(completedFile);
        assertEquals("test_file.txt", completedFile.getFileName());

        // 6. Storage usage updated
        StorageInfoResponse updatedStorage = dashboardService.getStorageInfo(user1);
        assertEquals(100L, updatedStorage.getUsedBytes());

        // 7. Check notification created
        List<NotificationResponse> notifications = notificationService.getUserNotifications(user1);
        assertFalse(notifications.isEmpty());
        assertEquals("UPLOAD_COMPLETE", notifications.get(0).getType());
    }

    @Test
    void test3_SharingAccessControlAndInheritance() {
        authenticateAs(user1);

        // User 1 creates parent folder "Folder X" and subfolder "SubFolder" and file "c.txt"
        FolderResponse folderX = dashboardService.createFolder(user1, new FolderCreateRequest("Folder X", null));
        FolderResponse subFolder = dashboardService.createFolder(user1, new FolderCreateRequest("SubFolder", folderX.getId()));

        UploadInitRequest initReq = new UploadInitRequest("c.txt", 20L, 1, subFolder.getId());
        UploadSessionResponse session = uploadService.initUploadSession(user1, initReq);
        MockMultipartFile chunk = new MockMultipartFile("file", "chunk0.part", "text/plain", "c data".getBytes());
        uploadService.uploadChunk(user1, session.getSessionId(), 0, chunk);
        FileItemResponse childFile = uploadService.completeUploadSession(user1, session.getSessionId());

        // User 1 shares "Folder X" with User 2 (EDIT permission)
        ShareRequest shareReq = new ShareRequest(null, folderX.getId(), user2.getEmail(), "EDIT");
        ShareResponse shareResp = shareService.shareItem(user1, shareReq);
        assertNotNull(shareResp);

        // Notification created for User 2
        authenticateAs(user2);
        List<NotificationResponse> user2Notifs = notificationService.getUserNotifications(user2);
        assertFalse(user2Notifs.isEmpty());
        assertEquals("SHARE_FILE", user2Notifs.get(0).getType());

        // User 2 tests inherited EDIT permission on SubFolder and child file c.txt
        DashboardResponse subFolderDashboard = dashboardService.getFolderDashboard(user2, subFolder.getId());
        assertNotNull(subFolderDashboard);
        assertEquals("EDIT", subFolderDashboard.getCurrentFolder().getPermission());

        // User 2 can rename c.txt due to inherited EDIT
        FileItemResponse renamedChild = fileService.renameFile(user2, childFile.getId(), new RenameRequest("renamed_c.txt"));
        assertEquals("renamed_c.txt", renamedChild.getFileName());

        // Requirement 4: User 2 (EDIT permission) attempts to share Folder X -> FAILS (Only Owner can manage sharing)
        ShareRequest illegalShare = new ShareRequest(null, folderX.getId(), user3.getEmail(), "VIEW");
        assertThrows(RuntimeException.class, () -> shareService.shareItem(user2, illegalShare));

        // Requirement 15 (IDOR): User 3 attempts to access Folder X -> FAILS (403 Forbidden / RuntimeException)
        authenticateAs(user3);
        assertThrows(RuntimeException.class, () -> dashboardService.getFolderDashboard(user3, folderX.getId()));
    }

    @Test
    void test4_PublicShareLinksFlow() {
        authenticateAs(user1);

        // User 1 creates folder & public link
        FolderResponse folder = dashboardService.createFolder(user1, new FolderCreateRequest("Public Shared", null));
        ShareLinkCreateRequest linkReq = new ShareLinkCreateRequest(null, folder.getId(), LocalDateTime.now().plusDays(1));

        ShareLinkResponse linkResp = shareLinkService.createShareLink(user1, linkReq);
        assertNotNull(linkResp);
        assertNotNull(linkResp.getToken());

        String token = linkResp.getToken();

        // Anonymous user accesses public link
        Map<String, Object> publicDetails = shareLinkService.getPublicLinkDetails(token, null);
        assertNotNull(publicDetails);
        assertEquals("VIEW", publicDetails.get("permission"));

        // User 1 deactivates link
        shareLinkService.deactivateShareLink(user1, linkResp.getId());

        // Anonymous user accesses deactivated link -> FAILS with Exception
        assertThrows(RuntimeException.class, () -> shareLinkService.getPublicLinkDetails(token, null));
    }

    @Test
    void test5_SoftDeleteTrashAndRestoration() {
        authenticateAs(user1);

        // Create folder and upload file
        FolderResponse folder = dashboardService.createFolder(user1, new FolderCreateRequest("Trash Target", null));
        UploadInitRequest initReq = new UploadInitRequest("file_to_trash.txt", 50L, 1, null);
        UploadSessionResponse session = uploadService.initUploadSession(user1, initReq);
        MockMultipartFile chunk = new MockMultipartFile("file", "chunk0.part", "text/plain", "data".getBytes());
        uploadService.uploadChunk(user1, session.getSessionId(), 0, chunk);
        FileItemResponse file = uploadService.completeUploadSession(user1, session.getSessionId());

        // Initial storage = 50 bytes
        assertEquals(50L, dashboardService.getStorageInfo(user1).getUsedBytes());

        // Move file to trash
        trashService.trashFile(user1, file.getId());

        // File does not appear in active root dashboard
        DashboardResponse root = dashboardService.getRootDashboard(user1);
        assertTrue(root.getFiles().isEmpty());

        // Restore file
        trashService.restoreFile(user1, file.getId());
        DashboardResponse restoredRoot = dashboardService.getRootDashboard(user1);
        assertEquals(1, restoredRoot.getFiles().size());

        // Permanent Delete file
        trashService.permanentDeleteFile(user1, file.getId());
        assertEquals(0L, dashboardService.getStorageInfo(user1).getUsedBytes());
    }
}
