package com.example.vault_drive.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "fileExecutor")
    public Executor fileExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);        // 5 Thread chạy thường trực
        executor.setMaxPoolSize(10);       // Tối đa 10 Thread khi tải cao
        executor.setQueueCapacity(25);     // Hàng chờ 25 task trước khi spawn Thread mới
        executor.setThreadNamePrefix("FileWorker-");
        executor.initialize();
        return executor;
    }
}
