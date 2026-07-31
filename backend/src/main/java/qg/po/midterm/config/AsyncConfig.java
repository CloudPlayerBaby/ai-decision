package qg.po.midterm.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 开启 @Async，让 Workflow 在后台线程中运行。
 */
@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {
}
