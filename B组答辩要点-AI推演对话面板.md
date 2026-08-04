# B组答辩要点 — AI推演对话面板

## 角色定位

负责工作台右侧的 AI 推演对话面板：**步骤展示 + SSE 实时流 + 方案对比 + 确认操作**。

是整个系统"用户看到 AI 在思考什么"的唯一出口。

---

## 整体架构

```
WorkbenchPage（C组协调层）
  ├─ DecisionCanvasPanel（A组画布）
  └─ AnalysisChatPanel（你的面板）← 你负责
       ├─ StepLogCard       ← 打字机逐字动画
       ├─ ToolCallCard      ← 工具调用卡片
       ├─ OptionComparison  ← 五维评分方案对比
       ├─ ChatMessage       ← 用户原始问题气泡
       └─ ConfirmAction     ← 确认方案按钮（备用）

数据层（你负责）：
  useAnalysisStream     ← SSE hook（最核心）
  analysis.service.ts   ← API 封装层
  types/analysis.ts     ← 全部类型定义
```

**设计原则**：组件层不直接调 axios，全部走 services 层。所有接口对齐 `docs/02-api-contract-v2.0.md`。未使用 `any`，未新增 Redux/MobX/Tailwind。

---

## 一、SSE 流式架构（最核心的技术点）

### 1.1 为什么用 SSE 而不是 WebSocket 或轮询？

- **SSE 是单向推送**（服务端 → 客户端），推演场景只需要服务端推送进度，不需要双向通信
- **原生 EventSource API**，不需要第三方库，自动重连
- 比轮询节省带宽，比 WebSocket 简单

### 1.2 为什么需要 SSE Ticket？

原生 `EventSource` 不支持自定义 HTTP Header，没法在连接时携带 JWT Bearer Token 做鉴权。

**解决方案**：两步走
1. 先拿 JWT 调 `POST /analysis-tasks/{taskId}/sse-ticket`，后端返回一次性 ticket
2. 再用 `sseUrl?ticket=xxx` 建立 EventSource 连接

Ticker 有效期 60 秒，限当前用户、当前任务、一次连接。不得在 URL 中直接携带长期 accessToken。

### 1.3 完整连接流程

```
taskId 变化 / 刷新页面
        │
        ▼
GET /analysis-tasks/{taskId}  ← REST 恢复持久化步骤
        │
        ▼
POST /sse-ticket              ← 获取一次性 ticket
        │
        ▼
new EventSource(sseUrl)       ← 建立 SSE 连接
        │
        ├─ step_update   ← 步骤状态/内容增量
        ├─ tool_call     ← 工具调用事件
        ├─ result_ready  ← 结果校验通过
        ├─ task_failed   ← 任务失败
        └─ ping          ← 心跳保活
```

### 1.4 5种 SSE 事件处理

| 事件 | data 关键字段 | 前端处理 |
|------|-------------|---------|
| `step_update` | stepId, status, summary, content, progress | 更新步骤卡片 + 打字机增量续写 |
| `tool_call` | stepId, toolName, status, inputSummary, outputSummary | 追加/更新工具调用卡片 |
| `result_ready` | analysisResultId, decisionStatus | 触发 `onResultReady` 回调，拉取新草案 |
| `task_failed` | errorCode, message, retryable, failedStepId | 同步 retryable/failedStepId，显示重试按钮 |
| `ping` | serverTime | 心跳，防止代理超时断开 |

### 1.5 step_update 的 content 处理策略

契约规定：**同一 stepId 的 content 以最新完整文本覆盖，禁止字符串拼接**。

`mergeStepContent` 函数的判断链：
1. `nextContent === undefined` → 保持旧值（后端没发新内容）
2. `!previousContent` → 用新值（首次收到）
3. 状态是 `SUCCEEDED` / `FAILED` → 直接覆盖（终态，确保完整性）
4. 旧值是占位符（"思考中..."）→ 覆盖
5. `nextContent.startsWith(previousContent)` → 用新值（增量推送，新内容包含旧内容）
6. fallback → 覆盖（不拼接，保证合规）

---

## 二、指数退避重连机制

### 2.1 为什么需要重连？

SSE 连接可能因网络抖动、代理超时断开。**连接断开 ≠ 任务失败**，不能直接把任务标为 FAILED。

### 2.2 实现细节

```typescript
// 延迟公式
base = min(1000 × 2^n, 30000)   // 1s→2s→4s→8s→16s→30s（上限）
delay = base/2 + random × base/2 // 加随机抖动，防止惊群效应
```

| 重试次数 | base | 实际延迟范围 |
|---------|------|------------|
| 1 | 2s | 1s–2s |
| 2 | 4s | 2s–4s |
| 3 | 8s | 4s–8s |
| 4 | 16s | 8s–16s |
| 5+ | 30s | 15s–30s |

### 2.3 计数器生命周期

- `onopen` 成功 → 归零
- `taskId` 变化 → 归零
- 手动断开（`taskId = null`）→ 不重连

### 2.4 连接状态枚举

```
idle → connecting → connected →（断开）→ reconnecting → connected
                                                        → idle（放弃）
```

前端在 `reconnecting` 状态时显示"连接恢复中"，不标失败。

---

## 三、打字机逐字动画

### 3.1 实现原理

```typescript
// StepLogCard.tsx 核心逻辑
setInterval(() => {
  setDisplayedContent(current => {
    if (current.length >= targetContent.length) return current  // 打完，停
    return targetContent.slice(0, current.length + 1)           // 逐字 +1
  })
}, 20)  // 50 字/秒
```

### 3.2 三个关键保护机制

**① 防打断锁（`startedRef`）**

一旦打字机启动，后续 `animate` 变 false（SSE 推 SUCCEEDED）也不掐断。防止动画跑到一半被全量覆盖。

**② SSE 增量续写**

```typescript
if (!targetContent.startsWith(current)) return ''  // 内容不连续 → 重置
return current  // 内容连续 → 保持当前位置，继续打
```

SSE 推新内容时，如果新内容以已显示内容开头，打字机从当前位置继续；否则清空重来。

**③ REST 恢复的终态步骤**

`animate=false` → 直接显示全量，不跑动画。刷新页面时已完成的步骤立即完整展示。

### 3.3 animate 的判断条件

```typescript
// AnalysisChatPanel L132
animate = !isHistory && step.status === 'RUNNING'
```

只对"当前正在跑的步骤"启动动画。历史记录、终态步骤、局部重推中的旧步骤都不跑。

---

## 四、局部重推整条链路

### 4.1 触发场景

- 用户在画布上**删除候选方案节点**
- 用户**修改因素权重**
- 用户**删除因素→方案连线**
- 用户**删除因素节点**
- 用户**新增节点/连线**（结构变更，先保存再触发）

### 4.2 完整流程

```
用户操作（如删方案）
        │
        ▼
乐观删除（画布立即更新，用户无需等待）
        │
        ▼
PUT /decisions/{id}/canvas   ← 保存完整画布（已缺少被删节点）
        │
        ▼
后端返回 changedNodeIds     ← 后端对比前后画布差异
        │
        ▼
POST /decisions/{id}/partial-analysis
  { changedNodeIds: ["被删的optionId"] }
        │
        ▼
后端返回新 taskId + affectedNodeIds
        │
        ▼
useAnalysisStream 检测到 taskId 变化 → 自动重连
        │
        ▼
REST 恢复新 task 步骤 → SSE 推送新推演过程
        │
        ▼
result_ready 事件 → 前端拉新 AnalysisResult
        │
        ▼
OptionComparison 渲染新方案对比
```

### 4.3 方案删除的特殊处理

删方案时，`changedNodeIds` **直接用 `[被删的optionId]`**，不依赖后端 `response.changedNodeIds`。

**理由**：删方案节点是一个确定性操作，前端知道哪些节点被删除了。直接传比等后端算更可靠，也避免后端判断延迟导致的问题。

代码实现（`saveForOptionDeleteMutation`）：
```typescript
onSuccess: (_data, variables) => {
  const changedIds = [variables.deletedOptionId]  // 直接用被删的 ID
  startPartialAnalysisMutation.mutate(changedIds)
}
```

### 4.4 步骤合并

局部重推是一个新 task，后端只返回受影响的 2-3 步（如 `GENERATE_OPTIONS` → `COMPARE_OPTIONS`）。前端 `mergeSteps` 函数：

- 同名覆盖（新 task 的 `GENERATE_OPTIONS` 替换旧的）
- 不同名保留（旧 task 的 `UNDERSTAND`、`EXTRACT_FACTORS` 保留）
- 按标准步骤顺序排序

**效果**：用户在局部重推时看到完整的 6 步，其中 2 步在 RUNNING，其余 4 步保持 SUCCEEDED 不变。

### 4.5 局部重推返回的是什么？

不是 diff/patch。后端返回的是**完整的 AnalysisResult**（新草案），结构跟全量推演完全一致：

```typescript
{
  id: "ar_新草案",
  status: "PENDING_CONFIRM",
  understanding: "...",    // 可能不变
  factors: [...],          // 可能不变（未被影响的）
  options: [...],          // 重新生成
  recommendation: {...},   // 跟着新方案调整
  ...
}
```

前端用 `activeResultId` 追踪当前展示的草案；局部重推完成后自动切换到新草案。

---

## 五、按钮状态联动

| 场景 | 开始推演按钮 | 保存画布按钮 | 确认方案按钮 |
|------|------------|------------|------------|
| PENDING（未推演） | 可用 | 有修改才可用 | 灰掉 |
| ANALYZING（推演中） | 灰掉，显示"推演中…" | 灰掉 | 灰掉 |
| 动画跑完 | 变为"重新推演" | 可用 | **亮起** |
| WAITING_CONFIRM | 可用（重新推演） | 可用 | 可用 |
| COMPLETED | 可用（重新推演） | 可用 | **灰掉**（已确认） |
| 局部推演中 | 灰掉 | 灰掉 | 灰掉 |

**防重复提交**：所有按钮在 `loading` 状态时 `disabled`，双重保护。

---

## 六、方案对比（OptionComparison）

### 6.1 展示内容

- 五维评分：成本 / 时间 / 收益 / 风险 / 可行性（Ant Design `Rate` 组件，1-5 星）
- 推荐标签（蓝色 `Tag` + 星标图标）
- 已选择标签（绿色 `Tag`，显示用户倾向方案）
- 优/劣/风险列表

### 6.2 数据来源

```
result_ready → activeResultId
     → GET /decisions/{id}/analysis-result?resultId=新ID
     → AnalysisResult.options → OptionComparison
```

---

## 七、涉及的关键技术决策

### 7.1 SSE Ticket 模式

**问题**：`EventSource` 不能自定义 Header，无法传 JWT。
**方案**：先拿 JWT 换一次性 ticket，ticket 放 URL 参数里。

### 7.2 content 覆盖不拼接

契约要求同一 stepId 多次推送时，后端每次发完整最新文本，前端覆盖。不自己做字符串拼接——保证数据一致性。

### 7.3 打字机防打断

`startedRef` 锁保证动画完整性。用户看到的是流畅的打字效果，不会被 SSE 中途截断。

### 7.4 刷新恢复策略

先 REST 后 SSE：先调 `GET /analysis-tasks/{taskId}` 拿完整步骤渲染，再连 SSE 收增量。刷新页面不会从空白重新开始。

### 7.5 旧事件过滤

`streamTaskIdRef` 追踪当前 SSE 连接的 taskId。局部重推切换 task 时，旧 task 的 SSE 事件（在浏览器缓冲区里的）会被 `streamTaskIdRef.current !== event.taskId` 拦截，不污染新状态。

---

## 八、文件清单

| 文件 | 说明 |
|------|------|
| `src/hooks/useAnalysisStream.ts` | SSE hook：REST恢复→ticket→EventSource→事件消费→指数退避重连→步骤合并 |
| `src/features/analysis/AnalysisChatPanel.tsx` | 主面板：待机/loading/步骤列表/方案对比/历史记录/局部推演提示 |
| `src/features/analysis/StepLogCard.tsx` | 步骤卡片：Collapse折叠、状态图标、打字机动画、重试按钮 |
| `src/features/analysis/ToolCallCard.tsx` | 工具调用卡片：toolName+入参/结果摘要+状态标签 |
| `src/features/analysis/OptionComparison.tsx` | 方案对比：五维雷达/Rate评分、推荐/已选标签、优劣风险列表 |
| `src/features/analysis/ChatMessage.tsx` | 用户原始问题气泡 |
| `src/features/analysis/ConfirmAction.tsx` | 确认操作按钮（备用） |
| `src/types/analysis.ts` | 全部 SSE 事件、API 响应、决策选项类型定义 |
| `src/services/analysis.service.ts` | API 封装层（REST + SSE ticket），Mock 分支 |

---

## 九、编码规范遵守

- 组件内禁止直接调 axios，走 services 层 ✓
- 禁止使用 `any` ✓
- 未新增 Redux/MobX/Tailwind/第二套 UI 库 ✓
- `constraints` 是 `string` 不是 `string[]` ✓
- 同一 stepId 的 content 以最新值覆盖 ✓
- SSE 先请求 ticket 再建连接 ✓
- 不展示模型内部推理 ✓
