package com.example.vault_drive.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class DatabaseUnicodeInitializer implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        try {
            // Danh sách truy vấn kiểm tra và chuyển đổi riêng các trường tên (file / user full_name / folder / session file_name) sang NVARCHAR trong SQL Server
            String[] alterQueries = {
                "IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='full_name' AND DATA_TYPE='varchar') ALTER TABLE users ALTER COLUMN full_name NVARCHAR(255)",
                "IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='folders' AND COLUMN_NAME='name' AND DATA_TYPE='varchar') ALTER TABLE folders ALTER COLUMN name NVARCHAR(255) NOT NULL",
                "IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='files' AND COLUMN_NAME='file_name' AND DATA_TYPE='varchar') ALTER TABLE files ALTER COLUMN file_name NVARCHAR(255) NOT NULL",
                "IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='files' AND COLUMN_NAME='original_name' AND DATA_TYPE='varchar') ALTER TABLE files ALTER COLUMN original_name NVARCHAR(255)",
                "IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='upload_sessions' AND COLUMN_NAME='file_name' AND DATA_TYPE='varchar') ALTER TABLE upload_sessions ALTER COLUMN file_name NVARCHAR(255) NOT NULL"
            };

            for (String sql : alterQueries) {
                try {
                    jdbcTemplate.execute(sql);
                } catch (Exception e) {
                    System.err.println("[DatabaseUnicodeInitializer] Notice: " + e.getMessage());
                }
            }
            System.out.println("====== [DATABASE UNICODE] Tự động chuyển đổi các trường TÊN (User/File/Folder) sang NVARCHAR thành công ======");
        } catch (Exception e) {
            System.err.println("[DatabaseUnicodeInitializer] Error initializing unicode columns: " + e.getMessage());
        }
    }
}
