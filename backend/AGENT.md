# AI 情景推演决策系统 — 项目速查手册

> 适用范围：后端 `backend/` 目录 · Spring Boot 4.1 · Java 21 · PRD v2.0

---

## 1. 项目一句话

用户创建决策问题 → AI 异步推演（LangGraph4j 多步骤）→ 结构化结果校验 → 用户确认 → 生成报告。支持 SSE 实时进度、局部重推、画布编辑。

---

## 2. 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Spring Boot 4.1 + Spring Security 6.x |
| ORM | MyBatis-Plus 3.5.17 |
| AI 编排 | LangGraph4j 1.8.20（图状态机） |
| AI 调用 | Spring AI 2.0 + DeepSeek API（OpenAI 兼容） |
| 数据库 | MySQL 8.0 + Flyway 迁移 |
| 缓存/状态 | Redis（LangGraph4j Checkpoint 持久化） |
| 认证 | JWT（java-jwt 4.4.0）+ BCrypt |
| API 文档 | SpringDoc OpenAPI 2.7.0 |

---

## 3. 包结构与分层

```
qg.po.midterm
├── controller/        # REST 控制器
├── service/           # 业务接口 + impl/
├── workflow/          # AI 引擎核心（LangGraph4j 图编排）
│   ├── node/          #   图节点：RequirementAnalysis, FactorAnalysis, OptionGeneration,
│   │                  #          RiskAnalysis, ReportGeneration, Repair
│   ├── state/         #   图状态：DecisionState, Factor, Option
│   ├── event/         #   节点生命周期事件
│   ├── listener/      #   事件监听器
│   ├── DecisionWorkflow.java    # 图定义（节点 + 边 + 条件路由）
│   ├── WorkflowExecutor.java    # 执行器接口
│   └── impl/WorkflowExecutorImpl.java
├── entity/            # 数据库实体（MyBatis-Plus 映射）
├── mapper/            # MyBatis-Plus BaseMapper
├── dto/               # request/（入参）+ result/（AI 校验结果）
├── vo/                # 响应视图对象
├── config/            # Spring 配置（Security, CORS, Async, Workflow）
├── security/          # JWT 工具 + 认证过滤器
├── common/            # 公共组件
│   ├── enums/         #   ErrorCode, DecisionStatus, TaskStatus, NodeStatus
│   ├── exception/     #   BusinessException, GlobalExceptionHandler
│   ├── result/        #   Result<T> 统一响应包裹
│   └── constant/      #   常量
└── repository/        # 内存仓库
```

---

## 4. 团队角色与责任边界

| 角色 | 负责模块 | 关键文件 |
|------|---------|---------|
| **A**（AI 引擎） | LangGraph4j 编排、Spring AI 提示词、RepairNode、结构化校验 | `workflow/`, `dto/result/` |
| **B**（Web 层） | Controller、SSE、认证鉴权、前端联调 | `controller/`, `security/`, `config/SecurityConfig.java` |
| **C/D**（基础设施） | 数据库、Docker、Flyway、异步任务外壳、CRUD | `entity/`, `mapper/`, `docker-compose.yml` |

> **铁规：A/B/C/D 互不越权修改对方文件。** 当前 B 已完成认证模块（AuthController、UserController、SecurityConfig、JwtUtil）。

---

## 5. 数据库（9 张表）

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `sys_user` | 用户 | id, username, email(UK), password_hash |
| `decision` | 决策问题 | status, preferred_option_id, latest_task_id, has_pending_result, pending_result_id, report_id |
| `agent_run` | 推演任务 | run_type(FULL/PARTIAL), status, current_step, total_steps |
| `agent_step` | 推演步骤 | step_type(THINKING/TOOL_CALL), status, input_data(JSON), output_data(JSON) |
| `analysis_result` | AI 分析草案(V2 新增) | status(PENDING_CONFIRM/CONFIRMED), result_data(JSON) |
| `decision_factor` | 影响因素 | weight, source(AI/USER) |
| `decision_solution` | 候选方案 | 五维评分(cost/time/benefit/risk/feasibility) |
| `decision_canvas` | 画布 | canvas_data(JSON) |
| `decision_report` | 报告 | content(JSON) |

**迁移文件**：`src/main/resources/db/migration/`
- `V1__init_schema.sql` — 初始建表
- `V2__align_api_v2.sql` — 对齐 PRD v2.0（补 email、重命名列、新增 analysis_result）

**ID 映射**：DB 用 BIGINT 自增，API 返回带前缀字符串：
- 决策 `"d_" + id`，分析结果 `"ar_" + id`，任务 `"t_" + id`，报告 `"r_" + id`，用户 `"u_" + id`

---

## 6. 核心状态机

### 6.1 决策状态流转

```
PENDING → ANALYZING → WAITING_CONFIRM → COMPLETED
              ↘ PARTIAL_ANALYZING → WAITING_CONFIRM
              ↘ FAILED
```

### 6.2 推演步骤状态：WAITING → RUNNING → SUCCEEDED / FAILED

### 6.3 AI 推演步骤序列（LangGraph4j 图）

```
START → UNDERSTAND(问题理解) → EXTRACT_FACTORS(因素提取)
      → GENERATE_OPTIONS(方案生成) → COMPARE_OPTIONS(方案对比)
      → [校验失败?] → REPAIR(一次修复) → GENERATE_REPORT
      → [校验通过?] → GENERATE_REPORT → END
```

---

## 7. API 概览（PRD v2.0，前缀 `/api/v1`）

| # | 模块 | 接口 | 状态 |
|---|------|------|------|
| 5.1 | 认证 | `POST /auth/register` | ✅ 已实现 |
| 5.2 | 认证 | `POST /auth/login` | ✅ 已实现 |
| 5.3 | 认证 | `GET /users/me` | ✅ 已实现 |
| 6.1 | 决策 | `POST /decisions` | 桩 |
| 6.2 | 决策 | `GET /decisions` | 桩 |
| 6.3 | 决策 | `GET /decisions/{id}` | 桩 |
| 6.4 | 决策 | `DELETE /decisions/{id}` | 桩 |
| 7.1 | 推演 | `POST /decisions/{id}/analysis` | 桩 |
| 7.2 | 推演 | `GET /analysis-tasks/{id}` | 桩 |
| 7.3 | 推演 | `POST /analysis-tasks/{id}/steps/{sid}/retry` | 桩 |
| 8.1 | SSE | `POST /analysis-tasks/{id}/sse-ticket` | 桩 |
| 9.1 | 结果 | `GET /decisions/{id}/analysis-result` | 桩 |
| 9.2 | 结果 | `PUT /decisions/{id}/preferred-option` | 桩 |
| 9.3 | 结果 | `POST /decisions/{id}/confirm` | 桩 |
| 10.1 | 画布 | `GET /decisions/{id}/canvas` | 桩 |
| 10.2 | 画布 | `PUT /decisions/{id}/canvas` | 桩 |
| 10.3 | 画布 | `POST /decisions/{id}/partial-analysis` | 桩 |
| 11.1 | 报告 | `GET /reports/{id}` | 桩 |
| 11.2 | 报告 | `POST /decisions/{id}/regenerate-report` | 桩 |

---

## 8. 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { }
}
```

| HTTP | 业务码 | 场景 |
|------|--------|------|
| 200/201 | 0 | 成功 |
| 400 | 40001 | 参数校验失败 |
| 401 | 40101 | 未登录/Token 失效 |
| 404 | 40401 | 资源不存在（含越权，不暴露 403） |
| 409 | 40901 | 状态冲突/重复提交 |
| 422 | 42201 | AI 结果结构校验失败 |
| 500 | 50001 | 服务端错误 |

---

## 9. 关键设计决策

1. **JWT 无状态**：登录返回 accessToken（7200s），前端存 localStorage，每次请求带 `Authorization: Bearer <token>`
2. **越权返回 404**：不暴露 403，防止资源枚举攻击
3. **物理删除**：不实现软删除，DELETE 即真删
4. **无乐观锁**：不使用 version 字段，后端直接覆盖写入
5. **SSE Ticket 模式**：EventSource 不支持自定义 Header，前端先拿 ticket 再连 SSE（实现不在 A 组范围）
6. **AI 一次修复**：校验失败时 RepairNode 用错误列表 + 原 JSON 请求 AI 修复一次，仍失败则任务 FAILED
7. **画布整图保存**：前端传完整 nodes+edges 覆盖，后端计算 changedNodeIds 用于局部重推
8. **`summary` vs `content`**：summary 是简短标题（卡片折叠用），content 是 AI 长文本（卡片展开用），流式推送时后端以最新完整文本覆盖

---

## 10. 开发环境

### 启动数据库
```bash
docker-compose up -d
# MySQL 8.0, 端口 3306, 数据库 ai_decision, root/1234
```

### 配置环境变量
```bash
# 必须：DeepSeek API Key
export DEEPSEEK_API_KEY=sk-xxx

# 可选：JWT 密钥（有默认值）
export JWT_SECRET=your-secret
```

### 启动应用
```bash
./mvnw spring-boot:run
# 端口 8080，上下文路径 /api/v1
```

### Flyway 迁移
应用启动时自动执行 `src/main/resources/db/migration/` 下的 SQL 文件，无需手动操作。

---

## 11. Git 规范（来自 AI_RULES.md）

- **不要未经许可 commit/push**，可以 `git add`
- **commit 消息用中文**
- **push 前先 pull**
- **冲突时不得擅自解决**，必须通知用户手动处理
- 当前分支：`develop`，主分支：`main`

---

## 12. 当前实现状态速览

| 层 | 已实现 | 空桩 |
|----|--------|------|
| Controller | AuthController, UserController | DecisionController, AnalysisTaskController, AnalysisEventController, ReportController |
| Service | AuthService, AuthServiceImpl | DecisionService, AnalysisTaskService, AnalysisEventService, ReportService 及其 Impl |
| Workflow | DecisionWorkflow, WorkflowExecutorImpl, 全部 6 个 Node | — |
| Config | SecurityConfig | CorsConfig, AsyncConfig, WorkflowConfig |
| Mapper | SysUserMapper | DecisionMapper, AnalysisTaskMapper, DecisionNodeMapper, ReportMapper |
| Entity | 全部 7 个实体 | — |
| DTO/VO | 认证相关 + AnalysisResultDto, ValidationResult | DecisionVO, CreateTaskVO 等 |
| Exception | BusinessException, GlobalExceptionHandler | — |
