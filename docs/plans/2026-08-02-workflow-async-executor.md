# Workflow Async Executor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Spring's fallback async executor with a named, bounded `ThreadPoolTaskExecutor` dedicated to workflow dispatch.

**Architecture:** `AsyncConfig` will own a named `workflowTaskExecutor` bean with bounded concurrency, a bounded queue, identifiable thread names, overload backpressure, and graceful shutdown. Every workflow entry point in `AnalysisWorkflowDispatcher` will explicitly reference that bean so unrelated future `@Async` work cannot accidentally share this pool. Pool sizes remain externalized in `application.yaml` and can be overridden by environment variables.

**Tech Stack:** Java 21, Spring Boot 4.1, Spring Framework `@Async`, JUnit 5, AssertJ

---

### Task 1: Add a failing configuration contract test

**Files:**
- Create: `backend/src/test/java/qg/po/midterm/config/AsyncConfigTest.java`

**Step 1: Write the failing test**

Create a focused Spring context containing only `AsyncConfig`. Supply small test property values, then assert that:

- a bean named `workflowTaskExecutor` exists;
- the bean is a `ThreadPoolTaskExecutor`;
- core pool size, maximum pool size, and queue capacity match the supplied properties;
- worker names start with `workflow-`;
- shutdown waits for running tasks and has the configured await-termination duration;
- the rejection handler is `ThreadPoolExecutor.CallerRunsPolicy`.

Use an `AnnotationConfigApplicationContext`, add these properties before refresh, and close it in `@AfterEach`:

```java
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
assertThat(executor.getThreadNamePrefix()).isEqualTo("workflow-");
assertThat(executor.getThreadPoolExecutor().getQueue().remainingCapacity()).isEqualTo(5);
assertThat(executor.getThreadPoolExecutor().getRejectedExecutionHandler())
        .isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);
```

Also submit one short task and assert its thread name starts with `workflow-`; this verifies the configured executor actually creates the expected worker threads.

**Step 2: Run the test to verify it fails**

Run:

```bash
cd backend
./mvnw -Dtest=AsyncConfigTest test
```

Expected: FAIL because `AsyncConfig.WORKFLOW_TASK_EXECUTOR` and the named executor bean do not exist.

**Step 3: Commit the test**

```bash
git add backend/src/test/java/qg/po/midterm/config/AsyncConfigTest.java
git commit -m "测试：补充工作流异步线程池配置契约"
```

### Task 2: Define the bounded workflow executor

**Files:**
- Modify: `backend/src/main/java/qg/po/midterm/config/AsyncConfig.java`
- Modify: `backend/src/main/resources/application.yaml`

**Step 1: Add the named executor bean**

Keep `@EnableAsync` and `@EnableScheduling`, and add a public bean-name constant plus a `ThreadPoolTaskExecutor` bean. Read the four sizing/shutdown values from configuration and initialize the executor before returning it:

```java
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
```

Add the required imports for `Bean`, `Value`, `ThreadPoolTaskExecutor`, and `ThreadPoolExecutor`.

`CallerRunsPolicy` is intentional: once both the pool and queue are full, the submitting request thread performs the work. This applies backpressure without silently dropping a workflow. If production latency policy prefers immediate rejection, replace it with `AbortPolicy` and add explicit task-failure handling before implementation.

**Step 2: Add externally overridable defaults**

Under the existing top-level `app` section in `application.yaml`, add:

```yaml
app:
  async:
    workflow:
      core-pool-size: ${WORKFLOW_ASYNC_CORE_POOL_SIZE:4}
      max-pool-size: ${WORKFLOW_ASYNC_MAX_POOL_SIZE:8}
      queue-capacity: ${WORKFLOW_ASYNC_QUEUE_CAPACITY:100}
      await-termination-seconds: ${WORKFLOW_ASYNC_AWAIT_TERMINATION_SECONDS:30}
  demo:
    fail-option-generation-once: ${DEMO_FAIL_OPTION_GENERATION_ONCE:false}
```

Do not create a second `app:` key; extend the existing section.

**Step 3: Run the focused test**

Run:

```bash
cd backend
./mvnw -Dtest=AsyncConfigTest test
```

Expected: PASS; the bean has the configured bounds and executes work on a `workflow-*` thread.

**Step 4: Commit the executor configuration**

```bash
git add backend/src/main/java/qg/po/midterm/config/AsyncConfig.java backend/src/main/resources/application.yaml
git commit -m "配置：新增有界工作流异步线程池"
```

### Task 3: Bind every workflow dispatch entry point explicitly

**Files:**
- Modify: `backend/src/main/java/qg/po/midterm/service/impl/AnalysisWorkflowDispatcher.java:29`
- Modify: `backend/src/main/java/qg/po/midterm/service/impl/AnalysisWorkflowDispatcher.java:52`
- Modify: `backend/src/main/java/qg/po/midterm/service/impl/AnalysisWorkflowDispatcher.java:78`
- Test: `backend/src/test/java/qg/po/midterm/config/AsyncConfigTest.java`

**Step 1: Extend the failing contract test**

Reflect over `startFullAnalysis`, `startPartialAnalysis`, and `retryStep`. For each method, retrieve its `@Async` annotation and assert its `value()` equals `AsyncConfig.WORKFLOW_TASK_EXECUTOR`.

```java
assertThat(method.getAnnotation(Async.class).value())
        .isEqualTo(AsyncConfig.WORKFLOW_TASK_EXECUTOR);
```

**Step 2: Run the test to verify it fails**

Run:

```bash
cd backend
./mvnw -Dtest=AsyncConfigTest test
```

Expected: FAIL because the current annotations use an empty executor qualifier.

**Step 3: Qualify all workflow `@Async` annotations**

Add a static import of `AsyncConfig.WORKFLOW_TASK_EXECUTOR` and change all three annotations:

```java
@Async(WORKFLOW_TASK_EXECUTOR)
```

Do not change exception handling or workflow behavior in this task.

**Step 4: Run the focused test**

Run:

```bash
cd backend
./mvnw -Dtest=AsyncConfigTest test
```

Expected: PASS.

**Step 5: Commit the explicit binding**

```bash
git add backend/src/main/java/qg/po/midterm/service/impl/AnalysisWorkflowDispatcher.java backend/src/test/java/qg/po/midterm/config/AsyncConfigTest.java
git commit -m "修复：显式绑定工作流异步执行器"
```

### Task 4: Verify backend regression safety and operational behavior

**Files:**
- Modify only if needed: `backend/README.md`

**Step 1: Run the complete backend test suite**

Run:

```bash
cd backend
./mvnw test
```

Expected: BUILD SUCCESS with all existing and new tests passing.

**Step 2: Perform a local smoke test**

Start the application's dependencies and backend using the project's documented commands, submit more workflow requests than the core pool size, and inspect logs/thread dumps. Verify:

- workflow execution threads are named `workflow-*`;
- active workers never exceed `WORKFLOW_ASYNC_MAX_POOL_SIZE`;
- queued work is bounded by `WORKFLOW_ASYNC_QUEUE_CAPACITY`;
- when saturated, backpressure occurs instead of spawning unlimited threads;
- application shutdown waits up to the configured timeout for in-flight workflow tasks.

**Step 3: Document tuning knobs if operators use the README**

If `backend/README.md` is the deployment source of truth, add the four `WORKFLOW_ASYNC_*` variables and explain that values must be sized against LLM provider concurrency limits, database connections, memory, and acceptable queueing latency. Avoid claiming the defaults are universal production values.

**Step 4: Commit documentation, if changed**

```bash
git add backend/README.md
git commit -m "文档：说明工作流线程池调优参数"
```

### Acceptance criteria

- No workflow method relies on Spring's fallback `SimpleAsyncTaskExecutor`.
- The workflow pool has explicit maximum threads and queue capacity.
- Pool configuration can be overridden without rebuilding the application.
- Thread names identify workflow work in logs and thread dumps.
- Saturation does not create unbounded threads or silently discard a workflow.
- Graceful shutdown behavior is configured and covered by the configuration contract test.
- The full backend test suite passes.
