# Option Score Partial Analysis Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复修改已有方案五维评分后被误判为因素变化、错误地从方案生成阶段重推并覆盖用户评分的问题。

**Architecture:** 画布持久化严格遵循 API 白名单，因素只保存权重、方案只保存五维评分。节点变更检测按节点类型比较可编辑业务字段，忽略 AI 展示字段和坐标，从而让方案修改只进入方案对比阶段。

**Tech Stack:** Java 21、Spring Boot、Jackson 3、JUnit 5、LangGraph4j

---

### 任务一：约束画布持久化字段

**文件：**
- 修改：`backend/src/main/java/qg/po/midterm/service/impl/CanvasMergeService.java`
- 测试：`backend/src/test/java/qg/po/midterm/service/impl/CanvasMergeServiceTest.java`

1. 添加测试，断言因素节点只包含 `weight`，方案节点只包含 `scores`。
2. 运行测试并确认旧实现失败。
3. 删除画布合并时写入的 `description/pros/cons/risks` 展示字段。
4. 运行测试并确认通过。

### 任务二：按节点类型计算业务变更

**文件：**
- 新增：`backend/src/main/java/qg/po/midterm/service/impl/CanvasNodeComparator.java`
- 修改：`backend/src/main/java/qg/po/midterm/service/impl/DecisionServiceImpl.java`
- 新增测试：`backend/src/test/java/qg/po/midterm/service/impl/CanvasNodeComparatorTest.java`

1. 添加因素、方案、坐标和展示字段差异的测试用例。
2. 实现节点类型感知比较：因素比较 `type/label/weight`，方案比较 `type/label/scores`。
3. 让 `DecisionServiceImpl` 使用新比较器。
4. 运行定向测试并确认通过。

### 任务三：验证局部推演路由

**文件：**
- 测试：`backend/src/test/java/qg/po/midterm/service/impl/PartialAnalysisPlannerTest.java`

1. 补充“仅方案变化从 `COMPARE_OPTIONS` 开始”的回归测试。
2. 运行画布合并、节点比较和局部推演规划测试。
3. 使用 JDK 21 编译相关后端代码，确认无编译错误。

### 任务四：交付中文说明

1. 在本文末尾记录实际修改、数据流变化和测试结果。
2. 由用户审阅并明确确认后提交 Git。

## 实施结果

### 已完成修改

1. `CanvasMergeService` 生成持久化画布时：
   - 因素节点的 `data` 只保留 `weight`。
   - 方案节点的 `data` 只保留 `scores`。
   - `description`、`pros`、`cons`、`risks` 继续保存在分析结果中，不再混入画布数据。

2. 新增 `CanvasNodeComparator`：
   - 因素节点只比较 `type`、`label`、`weight`。
   - 方案节点只比较 `type`、`label`、五维评分。
   - 节点坐标和 AI 展示字段不参与业务变更判断。
   - 数值比较兼容不同的 Java `Number` 具体类型。

3. `DecisionServiceImpl` 使用新的业务字段比较器计算 `changedNodeIds`。

4. 补充局部推演路由回归测试：仅修改已有方案时，起点为 `COMPARE_OPTIONS`。

### 修复后的数据流

```text
用户修改已有方案的五维评分
→ 前端保存完整画布
→ 后端只识别该方案节点发生变化
→ changedNodeIds 只包含该方案 ID
→ PartialAnalysisPlanner 选择 COMPARE_OPTIONS
→ 保留用户填写的五维评分
→ 重新计算方案比较、推荐理由和后续行动
```

因素权重发生变化时仍保持原有规则：从 `GENERATE_OPTIONS` 开始重新生成受影响方案。

### 验证结果

使用 JDK `C:\Users\Administrator\.jdks\temurin-21.0.11` 运行以下定向测试：

- `CanvasMergeServiceTest`
- `CanvasNodeComparatorTest`
- `PartialAnalysisPlannerTest`

测试结果：

```text
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

说明：项目的 Sentry Maven 扩展在 Maven 启动时仍会尝试连接 Sentry，并输出本机 SSL 凭据错误；该扩展错误未影响本次定向测试执行和结果。
