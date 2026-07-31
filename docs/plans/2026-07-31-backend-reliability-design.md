# 后端可靠性与局部推演修复设计

## 目标

修复数据库迁移、计算器安全、局部推演、草案确认、失败恢复、AI 校验、任务超时、SSE 一致性、参数校验和本地配置问题，使完整分析与局部推演链路能够稳定联调。

## 已确认的业务规则

### 画布合并

- 相同 ID 的节点保留用户坐标，以新分析结果覆盖名称、描述、权重、评分等业务字段。
- 新结果产生的新节点加入画布并自动布局。
- 新结果中已不存在的 AI 节点从画布删除。
- 用户创建的临时节点只要仍存在于最终分析结果中就保留。
- 根据最终因素和方案重建受影响业务连线。

### 局部推演范围

- 节点类型以画布 `type` 和当前分析结果为准，不再依赖 `f_`、`opt_` 前缀猜测。
- 因素变化从 `GENERATE_OPTIONS` 开始，影响该因素以及全部方案节点。
- 方案变化从 `COMPARE_OPTIONS` 开始，影响发生变化的方案节点。
- 决策根节点或未知节点变化从 `UNDERSTAND` 开始，保守地影响完整业务图。

### 校验失败与重试

- understanding 错误定位到 `UNDERSTAND`。
- factors 错误定位到 `EXTRACT_FACTORS`。
- options、方案 ID、五维评分错误定位到 `GENERATE_OPTIONS`。
- recommendation、nextActions 错误定位到 `COMPARE_OPTIONS`。
- 目标步骤标记为 `FAILED`，下游步骤重置为 `WAITING`。
- 重试接口根据传入 stepId 重建状态并从对应业务节点执行，不依赖旧失败 checkpoint。

### 中断与超时

- 应用启动时将遗留 RUNNING/PENDING 任务转换为可重试失败任务，不自动调用 AI 续跑。
- 当前 RUNNING 步骤或第一个未完成步骤标记为 FAILED。
- 单步骤连续 10 分钟没有任务状态更新即超时。
- Tavily 连接超时 5 秒、读取超时 20 秒，最多重试 3 次。

## 数据与事件设计

- 删除重复的后加入 V3，保留最早的 V3；新迁移从 V5 开始。
- `agent_run` 持久化 errorCode、missingFields、repairAttempted、retryable，保证 SSE 与刷新后的任务详情一致。
- Workflow 只发布一次最终失败事件，并保留原始异常对象。
- SSE 在事务提交成功后发送。
- 结果序列化失败时回滚成功处理，转为任务失败，不保存空 JSON。
- 选择方案和确认结果必须操作当前 `decision.pendingResultId`，并校验决策状态。

## AI 校验设计

- 结构解析失败时保留原始响应并自动修复一次。
- 最终业务校验失败时将原始完整分析 JSON、错误列表和格式要求交给 RepairNode 修复一次。
- 校验覆盖 ID、名称、数量、唯一性、权重、评分范围、推荐方案引用和行动建议。
- 成功结果写入 validation.schemaValid、validation.repaired 和 warnings。

## 验证范围

- Flyway 版本唯一性。
- 安全数学表达式计算与恶意 SpEL 拒绝。
- 临时 ID 和非标准 ID 的局部范围计算。
- 新旧结果画布合并及坐标保留。
- 旧 pendingResult 拒绝确认。
- AI 修复原 JSON、严格校验和错误步骤定位。
- 单一 task_failed、持久化错误、指定步骤重试。
- 启动恢复、10 分钟超时、事务提交后 SSE。
- 请求参数与 Docker/.env 配置一致性。
