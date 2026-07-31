# Backend Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复后端启动、安全计算、局部推演、草案状态、AI 校验、失败恢复、SSE 与参数配置问题。

**Architecture:** 将局部范围计算和画布合并抽成独立服务；将工作流失败统一为一个携带原始异常的事件；通过 V5 持久化任务错误详情；重试时从数据库步骤输出重建状态并使用新的 checkpoint 线程执行。

**Tech Stack:** Java 21、Spring Boot 4.1、MyBatis-Plus、Flyway、LangGraph4j、Spring AI、JUnit 5。

---

### Task 1: 修复迁移与本地配置

**Files:**
- Delete: `backend/src/main/resources/db/migration/V3__persist_previous_decision_status.sql`
- Create: `backend/src/main/resources/db/migration/V5__persist_task_error_details.sql`
- Modify: `backend/.env.example`
- Modify: `backend/docker-compose.yml`

**Steps:**
1. 删除后加入的重复 V3。
2. 新增 agent_run 错误详情字段迁移。
3. 统一 MySQL 3308、MySQL/Redis 默认密码变量。
4. 增加迁移版本唯一性测试。

### Task 2: 安全计算器

**Files:**
- Create: `backend/src/main/java/qg/po/midterm/workflow/tools/SafeMathEvaluator.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/tools/CalculatorTool.java`
- Test: `backend/src/test/java/qg/po/midterm/workflow/tools/SafeMathEvaluatorTest.java`

**Steps:**
1. 先写四则运算、括号、一元符号、非法字符、除零和 SpEL 攻击测试。
2. 实现递归下降解析器。
3. CalculatorTool 替换 SpEL。
4. 运行单元测试。

### Task 3: 局部范围与画布合并

**Files:**
- Create: `backend/src/main/java/qg/po/midterm/service/impl/PartialAnalysisPlanner.java`
- Create: `backend/src/main/java/qg/po/midterm/service/impl/CanvasMergeService.java`
- Modify: `backend/src/main/java/qg/po/midterm/service/impl/AnalysisTaskServiceImpl.java`
- Modify: `backend/src/main/java/qg/po/midterm/service/impl/AnalysisWorkflowDispatcher.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/WorkflowExecutor.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/impl/WorkflowExecutorImpl.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/listener/NodeExecutionEventListener.java`
- Test: planner 与画布合并单元测试。

**Steps:**
1. 测试 factor、option、tmp、删除节点和未知节点范围。
2. 实现按节点 type/结果语义计算 startNode 与 affectedNodeIds。
3. 实现坐标保留、业务数据覆盖、新增/删除节点和连线重建。
4. 完成结果时同步 decision_canvas。

### Task 4: 当前草案状态保护与参数校验

**Files:**
- Modify: request DTO、`DecisionController.java`、`AnalysisEventController.java`
- Modify: `DecisionServiceImpl.java`
- Test: 当前草案和非法状态服务测试。

**Steps:**
1. 为请求 DTO 增加 Bean Validation。
2. Controller 增加 `@Valid/@Validated` 和分页约束。
3. 选择与确认只接受当前 pendingResultId 及允许状态。

### Task 5: 单一失败事件、错误持久化与指定步骤重试

**Files:**
- Modify: `WorkflowFailedEvent.java`
- Modify: 所有 workflow node、`WorkflowExecutorImpl.java`
- Modify: `AnalysisTask.java`、`TaskErrorVO.java`
- Modify: `NodeExecutionEventListener.java`
- Modify: `AnalysisTaskServiceImpl.java`、dispatcher/executor 接口。
- Test: 错误映射、下游重置、状态重建与单一事件测试。

**Steps:**
1. WorkflowFailedEvent 保存 Exception。
2. 节点不再各自发布 FAILED，执行器统一发布一次。
3. 根据缺失字段定位失败步骤并重置下游。
4. 持久化错误详情并在任务详情恢复。
5. retryStep 使用 stepId，重建 DecisionState 并从目标节点执行。

### Task 6: AI 原 JSON 修复与严格校验

**Files:**
- Modify: `LlmRetryUtils.java`、所有结构化 AI 节点、`RepairNode.java`、`ValidateNode.java`、`DecisionState.java`
- Modify: `repair.st`、`ReportAgent.java`
- Test: strict validation 与 repair prompt 测试。

**Steps:**
1. LlmRetryUtils 返回内容及 repaired 标记。
2. Requirement 与 Report 接入统一解析修复。
3. RepairNode 传入完整原始 JSON。
4. ValidateNode 补齐业务规则，成功写 validation。
5. 修复失败抛 AiValidationException。

### Task 7: 超时、重启恢复与提交后 SSE

**Files:**
- Create: `backend/src/main/java/qg/po/midterm/service/impl/TaskRecoveryService.java`
- Modify: `TavilySearchTool.java`
- Modify: `NodeExecutionEventListener.java`
- Test: 中断恢复、超时和 afterCommit 行为测试。

**Steps:**
1. 启动时恢复遗留任务为可重试失败。
2. 每分钟扫描 10 分钟未更新的运行任务。
3. 忽略超时后迟到的节点完成事件。
4. Tavily 配置连接/读取超时。
5. 所有 SSE 注册为事务提交后发送。

### Task 8: 全量验证

**Steps:**
1. 运行 `mvn test`。
2. 运行编译和 Flyway 文件检查。
3. 检查工作树，只保留本次文件，保留用户现有 `.idea` 与 `backend/docker/` 变更。
4. 输出改动函数、迁移和验证结果；不自动 commit/push。
