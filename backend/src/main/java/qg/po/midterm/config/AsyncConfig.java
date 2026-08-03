package qg.po.midterm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * 开启 @Async，让 Workflow 在后台线程中运行。
 */
@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {

    public static final String WORKFLOW_TASK_EXECUTOR = "workflowTaskExecutor";

    @Bean(name = WORKFLOW_TASK_EXECUTOR)
    public ThreadPoolTaskExecutor workflowTaskExecutor(
            @Value("${app.async.workflow.core-pool-size}") int corePoolSize,
            @Value("${app.async.workflow.max-pool-size}") int maxPoolSize,
            @Value("${app.async.workflow.queue-capacity}") int queueCapacity,
            @Value("${app.async.workflow.await-termination-seconds}") int awaitTerminationSeconds) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("workflow-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(awaitTerminationSeconds);
        executor.initialize();
        return executor;
    }
}
