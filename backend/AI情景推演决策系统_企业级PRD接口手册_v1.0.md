# AI 情景推演决策系统

> REST API · SSE 事件协议 · 数据契约 · 联调规范

| **文档属性** | **内容**                                  |
|--------------|-------------------------------------------|
| 版本         | v1.0                                      |
| 状态         | 可用于接口评审与第一轮联调                |
| 适用对象     | 产品、前端、后端、测试、部署负责人        |
| 基准日期     | 2026-07-29                                |
| 接口前缀     | /api/v1                                   |
| 数据格式     | JSON（UTF-8）；SSE 使用 text/event-stream |

*使用说明：本文档是团队唯一接口口径。字段、枚举、错误码、状态流转及 SSE 事件以本文档为准；任何修改需经前后端双方确认并更新版本。*

# 1. 文档目标与范围

本手册定义“AI 情景推演决策系统”的前后端 API 契约，覆盖认证、决策问题、异步 Agent 推演、SSE 进度、决策画布、局部重推、结果确认与报告。它不是数据库设计说明；后端可自行调整内部表结构，但不得改变对外契约。

## 1.1 业务主流程

1.  用户注册并登录，获取 JWT。

2.  创建一个决策问题，状态为 PENDING。

3.  发起异步推演，状态进入 ANALYZING；前端连接 SSE 并展示步骤日志。

4.  后端校验 Agent 的结构化结果，成功后进入 WAITING_CONFIRM。

5.  用户选择倾向方案并确认，系统生成正式报告，状态变为 COMPLETED。

6.  用户可查看历史记录、报告、完整过程；失败步骤可单独重试。

7.  用户编辑画布后可局部重推受影响子树，重推结果仍须确认后才生效。

## 1.2 关键边界

- AI 的最终结果必须是结构化 JSON；纯文本不能作为正式分析结果入库。

- 面向用户的“思考过程”是步骤日志、阶段性说明和工具调用摘要，不展示模型内部原始推理链。

- 所有决策数据必须按当前 userId 做资源归属校验；越权统一返回 403 或 404（推荐 404，避免资源枚举）。

- SSE 仅负责实时通知；刷新恢复以 REST 查询到的持久化任务/步骤状态为准。

# 2. 通用约定

## 2.1 域名、版本与请求头

| **项目**     | **约定**                                                                    |
|--------------|-----------------------------------------------------------------------------|
| Base URL     | 开发环境：http://localhost:8080/api/v1；生产环境由 Nginx 反向代理到 /api/v1 |
| Content-Type | application/json; charset=UTF-8                                             |
| 认证头       | Authorization: Bearer \<accessToken\>                                       |
| 时间格式     | ISO 8601，示例：2026-07-29T21:30:00+08:00                                   |
| 分页         | page 从 1 开始；pageSize 默认 10，最大 100                                  |
| 幂等性       | 创建任务、确认报告、局部重推建议传 X-Idempotency-Key（UUID）                |
| 删除策略     | 逻辑删除；删除后详情和列表不可再被当前用户读取                              |

## 2.2 统一响应包裹

```json
{  
"code": 0,  
"message": "success",  
"data": {},  
"requestId": "req_01J...",  
"timestamp": "2026-07-29T21:30:00+08:00"  
}
```

| **字段**  | **类型**                | **说明**                                                             |
|-----------|-------------------------|----------------------------------------------------------------------|
| code      | integer                 | 业务码。0 表示成功；非 0 表示业务失败。HTTP 状态码仍表达协议层结果。 |
| message   | string                  | 给用户/开发者阅读的简短说明。                                        |
| data      | object \| array \| null | 成功时返回业务数据；失败通常为 null 或错误详情。                     |
| requestId | string                  | 服务端生成的请求追踪 ID；联调报错必须附上。                          |
| timestamp | string                  | 服务端响应时间，ISO 8601。                                           |

## 2.3 HTTP 状态与业务错误码

| **HTTP** | **业务码** | **场景**            | **前端处理**                           |
|----------|------------|---------------------|----------------------------------------|
| 200/201  | 0          | 请求成功            | 渲染 data。                            |
| 400      | 40001      | 参数校验失败        | 显示字段错误；不重试。                 |
| 401      | 40101      | 未登录、Token 失效  | 清除登录态，跳转登录页；保留当前路由。 |
| 403      | 40301      | 无权限              | 提示无权限，返回列表。                 |
| 404      | 40401      | 资源不存在/已删除   | 提示资源不存在。                       |
| 409      | 40901      | 状态冲突/重复提交   | 刷新详情状态，禁止重复操作。           |
| 422      | 42201      | AI 结果结构校验失败 | 展示失败详情；允许重试任务或步骤。     |
| 429      | 42901      | 限流                | 提示稍后重试；按 retryAfter 等待。     |
| 500      | 50001      | 未预期服务端错误    | 展示兜底错误，附 requestId。           |
| 503      | 50301      | AI/外部工具不可用   | 展示可重试状态。                       |

# 3. 核心枚举与状态机

## 3.1 决策问题状态

| **枚举**          | **含义**                           | **允许操作**                                                    |
|-------------------|------------------------------------|-----------------------------------------------------------------|
| PENDING           | 已创建，尚未推演                   | 开始推演、编辑、删除。                                          |
| ANALYZING         | 整轮推演进行中                     | 查看进度、取消（可选）、刷新恢复。                              |
| PARTIAL_ANALYZING | 局部重推进行中                     | 查看局部范围和进度；原已确认结果仍可展示但标识为旧版本。        |
| WAITING_CONFIRM   | 结构化结果已通过校验，等待用户确认 | 查看/编辑画布、选择倾向方案、确认、局部重推、重新发起整轮推演。 |
| COMPLETED         | 报告已正式生成                     | 查看报告、重新生成报告、编辑画布并局部重推。                    |
| FAILED            | 推演或报告生成失败                 | 查看失败步骤、重试步骤或整轮推演。                              |
| DELETED           | 逻辑删除（不对普通列表展示）       | 无。                                                            |

## 3.2 推演步骤状态

| **枚举**  | **说明**                                       |
|-----------|------------------------------------------------|
| WAITING   | 尚未执行，等待前置步骤。                       |
| RUNNING   | 执行中。                                       |
| SUCCEEDED | 已成功，结果持久化。                           |
| FAILED    | 失败，记录 errorCode、errorMessage、错误时间。 |
| SKIPPED   | 因上游失败或局部重推范围不涉及而跳过。         |

标准步骤建议：UNDERSTAND（问题理解）→ EXTRACT_FACTORS（因素提取）→ TOOL_CALL（外部工具，可选）→ GENERATE_OPTIONS（方案生成）→ COMPARE_OPTIONS（方案对比）→ VALIDATE_RESULT（结构校验/一次修复）→ GENERATE_REPORT（确认后执行）。

# 4. 数据模型（API 视图）

## 4.1 DecisionProblem

| **字段**            | **类型**       | **必填** | **说明**                                   |
|---------------------|----------------|----------|--------------------------------------------|
| id                  | string         | 是       | 雪花 ID 或 UUID，JSON 中一律按字符串返回。 |
| title               | string         | 是       | 1–100 字。                                 |
| background          | string         | 否       | 问题背景，最大 2000 字。                   |
| goal                | string         | 是       | 决策目标，1–1000 字。                      |
| constraints         | string\[\]     | 否       | 时间、预算、能力等约束。                   |
| status              | DecisionStatus | 是       | 见 3.1。                                   |
| preferredOptionId   | string \| null | 否       | 用户当前倾向方案。                         |
| latestTaskId        | string \| null | 否       | 最近一次推演任务。                         |
| createdAt/updatedAt | datetime       | 是       | 服务端生成。                               |

## 4.2 AnalysisResult（通过校验的草案）

| **字段**       | **类型**   | **说明**                                             |
|----------------|------------|------------------------------------------------------|
| version        | integer    | 结果版本；局部重推与确认使用，防止旧页面覆盖新结果。 |
| understanding  | string     | 对问题和目标的理解。                                 |
| factors        | Factor\[\] | 关键因素；每项含 id、name、weight、description。     |
| options        | Option\[\] | 2–3 个候选方案；每项含优点、缺点、风险、五维评分。   |
| recommendation | object     | 推荐 optionId、reason。                              |
| nextActions    | string\[\] | 下一步行动建议。                                     |
| canvas         | Canvas     | 画布节点和边。                                       |
| validation     | object     | schemaValid、repaired、warnings。                    |

## 4.3 Option 与五维评分

| **字段**                                  | **类型**   | **规则**                                            |
|-------------------------------------------|------------|-----------------------------------------------------|
| id/name                                   | string     | 在同一结果版本内唯一；name 1–80 字。                |
| pros/cons/risks                           | string\[\] | 各 0–8 项；每项 ≤ 200 字。                          |
| scores.cost/time/benefit/risk/feasibility | integer    | 均为 1–5；统一规则为“5 更优”。风险分 5 表示低风险。 |
| scoreRationale                            | object     | 五个维度各有一句解释，用于前端悬浮提示。            |

# 5. 认证与用户接口

## 5.1 注册

POST /auth/register

**Request**

```json
{ "username": "pearl", "email": "pearl@example.com", "password": "Abc123456" }
```

**Response data**

```json
{ "id": "u_10001", "username": "pearl", "email": "pearl@example.com", "createdAt": "2026-07-29T21:30:00+08:00" }
```

| **校验项** | **规则**                                      |
|------------|-----------------------------------------------|
| username   | 3–30 位，仅字母、数字、下划线；唯一。         |
| email      | 合法邮箱且唯一。                              |
| password   | 8–64 位，至少包含字母和数字；服务端仅存哈希。 |

## 5.2 登录

POST /auth/login

**Request**

```json
{ "account": "pearl@example.com", "password": "Abc123456" }
```

**Response data**

```json
{
"accessToken": "eyJ...",
"tokenType": "Bearer",
"expiresIn": 7200,
"user": { "id": "u_10001", "username": "pearl", "email": "pearl@example.com" }
}
```

## 5.3 当前用户

GET /users/me（需要 Bearer Token）

## 5.4 登出

POST /auth/logout。若项目采用无状态 JWT，可由前端清理 Token；若有刷新令牌，则后端需废止 refresh token。

# 6. 决策问题 CRUD 接口

## 6.1 创建问题

POST /decisions；成功返回 HTTP 201。

**Request**

```json
{
"title": "我应该优先学习 Redis 还是 Docker？",
"background": "我在准备 Java 后端面试。",
"goal": "一周内提升求职竞争力",
"constraints": \["每天 2 小时", "已有 Java 基础"\]
}
```

**Response data**

```json
{ "id": "d_20001", "status": "PENDING", "title": "我应该优先学习 Redis 还是 Docker？", "createdAt": "2026-07-29T21:30:00+08:00" }
```

## 6.2 分页列表

GET /decisions?page=1&pageSize=10&status=COMPLETED&keyword=Redis

**Response data**

```json
{
"list": \[{ "id": "d_20001", "title": "...", "status": "COMPLETED", "preferredOptionId": "opt_1", "updatedAt": "..." }\],
"page": 1, "pageSize": 10, "total": 21, "totalPages": 3
}
```

## 6.3 详情

GET /decisions/{decisionId}。返回 DecisionProblem、latestTask 摘要、latestResult 摘要、reportId；前端刷新详情时以此接口恢复页面基础状态。

## 6.4 更新与删除

| **接口**                       | **规则**                                                                                                                 |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| PATCH /decisions/{decisionId}  | 仅 PENDING、WAITING_CONFIRM、COMPLETED 可更新基础信息。若已有结果，修改目标/约束后应将结果标记为 stale，并提示用户重推。 |
| DELETE /decisions/{decisionId} | 成功 HTTP 204；ANALYZING/PARTIAL_ANALYZING 时建议返回 409，要求先取消或等待结束。                                        |

# 7. Agent 异步推演与任务接口

## 7.1 发起整轮推演

POST /decisions/{decisionId}/analysis；请求必须携带 X-Idempotency-Key。若当前已有运行任务，返回 40901。

**Response data**

```json
{
"taskId": "t_30001",
"decisionId": "d_20001",
"taskType": "FULL_ANALYSIS",
"status": "RUNNING",
"startedAt": "2026-07-29T21:31:00+08:00",
"sseUrl": "/api/v1/analysis-tasks/t_30001/events"
}
```

## 7.2 查询任务与恢复进度

GET /analysis-tasks/{taskId}。页面首次进入、刷新、SSE 断线重连前都应先调用此接口。

**Response data**

```json
{
"id": "t_30001", "status": "RUNNING", "progress": 42,
"steps": \[
{ "id": "s_1", "name": "UNDERSTAND", "displayName": "理解问题", "status": "SUCCEEDED", "startedAt": "...", "endedAt": "...", "summary": "已识别学习路径与时间约束" },
{ "id": "s_2", "name": "EXTRACT_FACTORS", "displayName": "提取关键因素", "status": "RUNNING", "summary": "正在分析时间、收益与风险" }
\],
"lastEventId": "evt_102"
}
```

## 7.3 查询完整过程日志

GET /analysis-tasks/{taskId}/logs?afterEventId=evt_100&limit=100。用于 SSE 断线后补齐缺失事件；日志按 eventId 递增。

## 7.4 重试失败步骤

POST /analysis-tasks/{taskId}/steps/{stepId}/retry。仅当该步骤为 FAILED 且前置步骤成功时允许；已成功步骤不得重跑。

**Response data**

```json
{ "taskId": "t_30001", "stepId": "s_4", "status": "WAITING", "message": "已加入重试队列" }
```

## 7.5 任务失败的错误详情

任务或步骤失败时，GET 任务详情中应返回 error：{ code, message, retryable, failedStepId }。前端仅在 retryable=true 时展示“重试”按钮。

# 8. SSE 事件协议

GET /analysis-tasks/{taskId}/events。请求头 Accept: text/event-stream；认证优先使用同域 Cookie，或由前端在建立连接前通过短期 SSE ticket 换取一次性 URL。原生 EventSource 不能自定义 Authorization Header，因此不要假定它能携带 Bearer Token。

## 8.1 连接与恢复

8.  前端先 GET /analysis-tasks/{taskId} 渲染持久化步骤。

9.  再连接 SSE；重连时携带 Last-Event-ID，或查询 /logs?afterEventId=... 补齐。

10. 服务端每 15–30 秒发送 ping 事件防止代理超时。

11. 连接异常不等于任务失败。前端显示“连接恢复中”，按指数退避重连。

## 8.2 标准事件

| **event**       | **何时发送**       | **data 核心字段**                                   |
|-----------------|--------------------|-----------------------------------------------------|
| task_snapshot   | 建立连接后         | taskId、status、progress、steps、lastEventId。      |
| step_update     | 步骤状态/摘要变化  | stepId、status、summary、startedAt、endedAt。       |
| display_message | 阶段性用户可见文案 | level、message、stepId。                            |
| tool_call       | 开始/完成工具调用  | toolName、status、inputSummary、outputSummary。     |
| result_ready    | 结构化结果校验通过 | decisionId、resultVersion、status=WAITING_CONFIRM。 |
| task_failed     | 任务最终失败       | errorCode、message、failedStepId、retryable。       |
| ping            | 心跳               | serverTime。                                        |

```json
event: step_update  
id: evt_102  
data: {"taskId":"t_30001","stepId":"s_2","status":"RUNNING","progress":42,"summary":"正在提取关键因素","occurredAt":"2026-07-29T21:31:12+08:00"}  
  
event: tool_call  
id: evt_103  
data: {"taskId":"t_30001","stepId":"s_3","toolName":"calculator","status":"SUCCEEDED","inputSummary":"比较每日学习时长","outputSummary":"两种方案均可在 14 小时内完成基础学习"}
```

# 9. 结果、方案与确认接口

## 9.1 获取待确认分析结果

GET /decisions/{decisionId}/analysis-result?version=latest。仅返回已通过校验的结果；状态非 WAITING_CONFIRM/COMPLETED 时可返回 409 或 null。

```json
Response data（节选）  
{  
"version": 3,  
"understanding": "用户希望在一周内选择优先学习方向。",  
"factors": \[{"id":"f_time","name":"时间成本","weight":0.30,"description":"一周内可获得的掌握程度"}\],  
"options": \[{"id":"opt_redis","name":"优先学习 Redis","pros":\["面试高频"\],"cons":\["需理解缓存场景"\],"risks":\["缺少项目实践"\],"scores":{"cost":4,"time":4,"benefit":5,"risk":3,"feasibility":4}}\],  
"recommendation": {"optionId":"opt_redis","reason":"..."},  
"nextActions": \["完成缓存基础", "做一个缓存穿透演示"\],  
"validation": {"schemaValid":true,"repaired":false,"warnings":\[\]}  
}
```

## 9.2 选择倾向方案（草稿）

PUT /decisions/{decisionId}/preferred-option。该操作不生成正式报告，仅保存用户倾向。

**Request**

```json
{ "optionId": "opt_redis", "resultVersion": 3 }
```

## 9.3 确认分析并生成报告

POST /decisions/{decisionId}/confirm。必须带 resultVersion；若版本不一致，返回 40901，前端要求刷新。成功后系统创建报告任务或同步生成报告。

**Request**

```json
{ "selectedOptionId": "opt_redis", "resultVersion": 3 }
```

**Response data**

```json
{ "decisionId": "d_20001", "status": "COMPLETED", "reportId": "r_40001", "reportStatus": "READY" }
```

# 10. 决策画布与局部重推接口

## 10.1 获取画布

GET /decisions/{decisionId}/canvas?version=latest。画布数据应独立于前端图形库；不要将 React Flow/Vue Flow 的内部字段直接当作唯一数据模型。

**Response data**

```json
{
"version": 3,
"nodes": \[
{"id":"root","type":"decision","label":"优先学习 Redis 还是 Docker","position":{"x":360,"y":40},"data":{}},
{"id":"f_time","type":"factor","label":"时间成本","position":{"x":140,"y":180},"data":{"weight":0.30}},
{"id":"opt_redis","type":"option","label":"优先学习 Redis","position":{"x":420,"y":340},"data":{"scores":{"cost":4,"time":4,"benefit":5,"risk":3,"feasibility":4}}}
\],
"edges": \[{"id":"e1","source":"root","target":"f_time","relation":"HAS_FACTOR"}\]
}
```

## 10.2 保存画布编辑

PUT /decisions/{decisionId}/canvas。支持拖拽位置、因素权重、增删因素/方案节点。请求携带 version 做乐观锁；结构修改成功后返回 newVersion 和 changedNodeIds。

**Request**

```json
{
"version": 3,
"operations": \[
{"op":"MOVE_NODE","nodeId":"f_time","position":{"x":160,"y":190}},
{"op":"UPDATE_FACTOR_WEIGHT","nodeId":"f_time","weight":0.40},
{"op":"ADD_FACTOR","node":{"tempId":"tmp_1","label":"项目实践机会","weight":0.20}}
\]
}
```

## 10.3 发起局部重推

POST /decisions/{decisionId}/partial-analysis。后端根据 changedNodeIds/changedFields 确定受影响子树；前端不可自行声明“只重算某一方案”并绕过后端依赖判定。

**Request**

```json
{ "baseVersion": 4, "changedNodeIds": \["f_time", "tmp_1"\], "reason": "用户调整时间权重并新增实践因素" }
```

**Response data**

```json
{ "taskId": "t_30002", "taskType": "PARTIAL_ANALYSIS", "status": "RUNNING", "affectedNodeIds": \["f_time", "opt_redis", "opt_docker"\], "sseUrl": "/api/v1/analysis-tasks/t_30002/events" }
```

**局部重推完成后生成候选 resultVersion，状态恢复到发起前的 WAITING_CONFIRM 或 COMPLETED，但新版本必须通过用户确认后才能覆盖正式报告。**

# 11. 报告接口

## 11.1 获取最终报告

GET /reports/{reportId} 或 GET /decisions/{decisionId}/report。报告由已确认的 AnalysisResult 生成，内容包括背景、目标与约束、因素、方案对比、推荐结论、风险和下一步行动。

**Response data**

```json
{
"id":"r_40001", "decisionId":"d_20001", "resultVersion":3, "status":"READY",
"content": {"background":"...", "objective":"...", "factorAnalysis":\[\], "optionComparison":\[\], "conclusion":"...", "riskAnalysis":\[\], "nextActions":\[\]},
"generatedAt":"2026-07-29T21:40:00+08:00"
}
```

## 11.2 重新生成报告

POST /reports/{reportId}/regenerate。仅基于已确认的 resultVersion 生成展示文稿，不重新调用分析 Agent；若要重新分析，应使用分析/局部重推接口。

# 12. AI 结果校验与后端实现约束

1. Agent 输出必须先解析为 JSON，再进行 JSON Schema / DTO 校验。

2. 必填项至少包括 understanding、factors、2–3 个 options、每方案五维 scores、recommendation、nextActions。

3. 校验失败时可将“校验错误列表 + 原 JSON”发送给修复流程一次；修复结果仍不合格即任务失败。

4. 只有 schemaValid=true 的结果可写入 decision_results 并进入 WAITING_CONFIRM。

5. 报告只能由用户确认的 resultVersion 生成；不得把流式文本当正式报告依据。

6. 记录每步输入摘要、输出摘要、错误、耗时和工具调用摘要；敏感 Token、完整密钥等不得落库或发送给前端。

## 12.1 推荐校验失败响应

```json
HTTP 422  
{  
"code": 42201,  
"message": "AI 结果结构校验失败",  
"data": {  
"taskId": "t_30001",  
"failedStepId": "s_6",  
"missingFields": \["options\[1\].scores.feasibility"\],  
"repairAttempted": true,  
"retryable": true  
},  
"requestId": "req_01J..."  
}
```

# 13. 前端联调与验收清单

## 13.1 每个接口的联调最小检查

- 请求参数与字段类型是否严格符合文档；尤其是 ID 作为 string、时间为 ISO 8601。

- 成功、空数据、参数错误、未登录、无权限、状态冲突五条路径均测试。

- 发起任务后刷新页面：先用任务详情恢复，再连 SSE；不得从 0% 重新展示。

- SSE 断开时不把任务直接标为 FAILED；可恢复后补齐日志，不重复展示同一 eventId。

- 确认报告时使用 resultVersion；模拟后台已有新版本，应正确收到 409 并刷新。

- 局部重推时检查 affectedNodeIds，且新结果需再次确认。

## 13.2 角色责任边界

| **角色**  | **交付物**                             | **验收口径**                                       |
|-----------|----------------------------------------|----------------------------------------------------|
| 前端      | 页面、接口调用封装、SSE 管理、状态兜底 | 不依赖 Mock 也能完整走主流程；错误可理解、可恢复。 |
| 后端      | API、鉴权、持久化、任务、SSE、AI 校验  | 接口文档字段一致；刷新恢复；越权不可访问。         |
| AI/Agent  | 步骤编排、工具调用、结构化结果和修复   | 正常和失败路径均可复现；不输出未校验正式结果。     |
| 测试/全员 | 验收脚本、问题单、部署回归             | 按题目验收场景逐项录屏或现场演示。                 |

## 13.3 联调问题单最小字段

| **字段**    | **示例**                                |
|-------------|-----------------------------------------|
| 接口        | POST /api/v1/decisions/d_20001/analysis |
| 环境与时间  | dev，2026-07-29 22:10                   |
| 请求        | 参数、Header（脱敏）、requestId         |
| 预期/实际   | 预期 status=RUNNING；实际返回 40901     |
| 复现步骤    | 创建问题后连续点击两次开始推演          |
| 负责人/状态 | 后端 B / 待修复                         |

# 14. 变更管理规则

- 字段新增：优先新增可选字段，前端做好未知字段兼容；不要无通知修改已有字段语义。

- 字段删除、枚举改名、类型修改：属于破坏性变更，必须提升 API 版本或在团队评审后统一迁移。

- 接口变更必须同时更新本文档、Swagger/OpenAPI、Mock 数据和前端 TypeScript 类型定义。

- 每次联调前确认环境 Base URL、数据库版本、分支/提交号、AI Key 配置状态。

文档结束。建议将本手册的接口清单同步到 Apifox / Swagger，并用 OpenAPI 生成前端 TypeScript 类型与 Mock；这样可以进一步减少手写字段不一致。
