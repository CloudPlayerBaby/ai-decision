# Prompt Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一决策工作流的提示词契约，减少结构化输出修复次数，并让风险分析和报告生成使用完整上下文。

**Architecture:** 在共享 `ChatClient` 上设置全局 system prompt，节点模板只保留各自任务和工具条件。保留节点级解析修复与工作流级语义修复两层职责，但共用修复提示构造器和输出格式约束。

**Tech Stack:** Java 21、Spring Boot 4.1、Spring AI 2.0、JUnit 5、StringTemplate 提示模板。

---

### Task 1: 统一全局提示词策略

**Files:**
- Create: `backend/src/main/java/qg/po/midterm/workflow/prompt/PromptPolicy.java`
- Modify: `backend/src/main/java/qg/po/midterm/config/WorkflowConfig.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/agent/ReportAgent.java`

1. 定义角色、输入隔离、工具调用、JSON 输出和事实约束。
2. 将策略配置为共享 `ChatClient` 的默认 system prompt。
3. 让 `ReportAgent` 复用共享客户端。

### Task 2: 统一修复提示

**Files:**
- Modify: `backend/src/main/java/qg/po/midterm/workflow/utils/LlmRetryUtils.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/node/RepairNode.java`
- Delete: `backend/src/main/resources/prompts/repair.st`
- Test: `backend/src/test/java/qg/po/midterm/workflow/utils/LlmRetryUtilsTest.java`

1. 提取共享修复提示构造器。
2. 节点级和工作流级修复均附加目标类型格式说明。
3. 测试修复提示包含错误、原始结果和 Schema。

### Task 3: 补齐节点上下文和约束

**Files:**
- Modify: `backend/src/main/resources/prompts/*.st`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/node/RiskAnalysisNode.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/node/ReportGenerationNode.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/agent/ReportAgent.java`

1. 删除重复格式指令和无效 `{format}`。
2. 为结构化节点补齐字段语义和正反示例。
3. 风险节点传递完整方案数据，报告节点传递完整推演数据。

### Task 4: 配置稳定性并验证

**Files:**
- Modify: `backend/src/main/resources/application.yaml`

1. 将结构化输出温度设为 `0.2`。
2. 扫描无效占位符、不可用工具和重复手动格式指令。
3. 使用 JDK 21 执行编译和全部单元测试。
