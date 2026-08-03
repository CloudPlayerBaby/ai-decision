package qg.po.midterm.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.util.ReflectionTestUtils;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.service.impl.AnalysisWorkflowDispatcher;
import qg.po.midterm.workflow.state.DecisionState;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class AsyncConfigTest {

    private AnnotationConfigApplicationContext context;

    @AfterEach
    void closeContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    void shouldConfigureBoundedWorkflowTaskExecutor() throws InterruptedException {
        context = new AnnotationConfigApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(
                new MapPropertySource("test", Map.of(
                        "app.async.workflow.core-pool-size", 2,
                        "app.async.workflow.max-pool-size", 3,
                        "app.async.workflow.queue-capacity", 5,
                        "app.async.workflow.await-termination-seconds", 10
                ))
        );
        context.register(AsyncConfig.class);
        context.refresh();

        ThreadPoolTaskExecutor executor = context.getBean(
                AsyncConfig.WORKFLOW_TASK_EXECUTOR,
                ThreadPoolTaskExecutor.class
        );

        assertThat(executor.getCorePoolSize()).isEqualTo(2);
        assertThat(executor.getMaxPoolSize()).isEqualTo(3);
        assertThat(executor.getQueueCapacity()).isEqualTo(5);
        assertThat(executor.getThreadNamePrefix()).isEqualTo("workflow-");
        assertThat(executor.getThreadPoolExecutor().getRejectedExecutionHandler())
                .isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);
        assertThat(ReflectionTestUtils.getField(executor, "waitForTasksToCompleteOnShutdown"))
                .isEqualTo(true);
        assertThat(ReflectionTestUtils.getField(executor, "awaitTerminationMillis"))
                .isEqualTo(10_000L);

        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<String> threadName = new AtomicReference<>();
        executor.execute(() -> {
            threadName.set(Thread.currentThread().getName());
            completed.countDown();
        });

        assertThat(completed.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(threadName.get()).startsWith("workflow-");
    }

    @Test
    void shouldBindEveryWorkflowEntryPointToDedicatedExecutor() throws NoSuchMethodException {
        assertUsesWorkflowExecutor(AnalysisWorkflowDispatcher.class.getMethod(
                "startFullAnalysis", String.class, String.class, Decision.class
        ));
        assertUsesWorkflowExecutor(AnalysisWorkflowDispatcher.class.getMethod(
                "startPartialAnalysis", String.class, String.class, String.class, DecisionState.class
        ));
        assertUsesWorkflowExecutor(AnalysisWorkflowDispatcher.class.getMethod(
                "retryStep", String.class, String.class, String.class, DecisionState.class
        ));
    }

    private void assertUsesWorkflowExecutor(Method method) {
        assertThat(method.getAnnotation(Async.class))
                .isNotNull()
                .extracting(Async::value)
                .isEqualTo(AsyncConfig.WORKFLOW_TASK_EXECUTOR);
    }
}
