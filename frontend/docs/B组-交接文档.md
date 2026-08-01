# B组（AI推演对话面板）交接文档

## 角色

B组负责工作台右侧的 AI 推演对话面板，包括步骤展示、SSE流式数据、方案对比、确认操作。

## 硬规则（接手必读）

1. **API 唯一口径：`docs/02-api-contract-v2.0.md`**，不允许任何主观猜测字段名或类型
2. **`constraints` 是 `string`，不是 `string[]`**
3. **同 `stepId` 的 `content` 覆盖旧值，禁止字符串拼接**
4. **SSE 先请求 ticket（`POST /sse-ticket`），再用返回的 `sseUrl` 建立 EventSource，不得在 URL 中直接携带 token**
5. **不展示模型内部推理**，只展示步骤日志、工具摘要、阶段文本
6. **组件内禁止直接调 axios**，必须走 services 层
7. **禁止使用 `any`**，禁止新增 Redux/MobX/Tailwind/第二套 UI 库/第二个请求库
8. **先说明准备修改哪些文件，再编码**
9. **完成后运行 `npm run lint`**

## 文件清单

### B组负责的文件

| 文件 | 说明 |
|------|------|
| `src/hooks/useAnalysisStream.ts` | SSE hook：REST恢复→ticket→EventSource→事件消费→3秒重连 |
| `src/features/analysis/AnalysisChatPanel.tsx` | 主面板：待机状态、步骤动画、方案对比、历史记录 |
| `src/features/analysis/StepLogCard.tsx` | 步骤卡片：Collapse折叠、状态图标、失败重试按钮 |
| `src/features/analysis/ToolCallCard.tsx` | 工具调用卡片：toolName、入参/结果摘要、状态标签 |
| `src/features/analysis/ChatMessage.tsx` | 用户消息气泡 |
| `src/features/analysis/OptionComparison.tsx` | 方案对比面板：五维评分Rate、推荐标签、已选标签（纯展示） |
| `src/features/analysis/ConfirmAction.tsx` | 确认操作（保留备用） |

### 需要协调的 B组入口

| 文件 | 说明 |
|------|------|
| `src/pages/workbench/WorkbenchPage.tsx` | 工作台壳子（C组），B组只改 `AnalysisChatPanel` 的 props 传入部分 |

### 别人写的、不要动

| 文件 | 归属 |
|------|------|
| `src/components/workbench/ConversationPanel.tsx` | C组骨架，历史版本 |
| `src/components/workbench/ConfirmResultModal.tsx` | C组确认弹窗 |
| `src/components/workbench/DecisionCanvasPanel.tsx` | A组画布 |
| `src/components/workbench/INTEGRATION.ts` | C组合入说明 |
| `src/components/workbench/workbenchContracts.ts` | C组契约定义 |
| `src/mocks/` 下所有文件 | 各组mock数据 |

## 当前进度

### 已完成

- [x] 静态页面结构：ChatMessage / StepLogCard / ToolCallCard / OptionComparison
- [x] 步骤动画：WAITING → RUNNING → SUCCEEDED 逐条展示
- [x] `useAnalysisStream` hook：REST恢复 + SSE连接 + 事件消费 + 3秒重连
- [x] 所有 SSE 事件：`step_update`、`tool_call`、`result_ready`、`task_failed`、`ping`
- [x] 同 stepId content 覆盖（不拼接）
- [x] 待机状态（idle）：点击"开始推演"前显示空状态提示
- [x] 历史记录：COMPLETED/WAITING_CONFIRM 直接展示方案对比，不跑动画
- [x] 已选方案标识：绿色"已选择"标签
- [x] 按钮状态联动：动画跑完→确认按钮亮→推演按钮灰→重新推演
- [x] COMPLETED 状态确认按钮灰掉
- [x] 步骤失败重试按钮（FAILED 状态显示）
- [x] taskId 变化时重置所有状态
- [x] 连接状态驱动底部文案（等待推演/连接中/已连接/连接恢复中）
- [x] 按钮防重复提交（loading + disabled）
- [x] `tool_call` 数据缺少 `stepId` 时也能渲染

### 待完成（需后端配合）

- [ ] `result_ready` 事件收到后方案对比从 API 数据展示（联调验证）
- [ ] `task_failed` 事件收到后 UI 表现（联调验证）
- [ ] 局部重推（A组画布接入后触发）：
  - `saveCanvas` → `changedNodeIds` → `startPartialAnalysis` → 新 `taskId`
  - hook 自动重连，面板显示局部推演提示
- [ ] 删除 setTimeout 模拟动画（后端 SSE 稳定推送后删除）
- [ ] 确认方案走 `POST /confirm` API，携带 `analysisResultId` + `selectedOptionId`

## SSH 数据流架构

```
taskId 变化
  ↓
REST: GET /analysis-tasks/{taskId}      ← 恢复已持久化步骤
  ↓
REST: POST /analysis-tasks/{taskId}/sse-ticket  ← 获取一次性 ticket
  ↓
SSE: new EventSource(sseUrl)            ← 建立连接
  ↓
事件消费:
  step_update    → 同 stepId 覆盖 content + summary
  tool_call      → stepId+toolName 去重覆盖
  result_ready   → setResultReady + 回调刷新 React Query
  task_failed    → setTaskFailed + 关闭 EventSource（不重连）
  ping           → 忽略
  ↓
断线 → 3秒后重连 → 重新 REST 恢复 + 重新获取 ticket + 重新 EventSource
```

## 连接状态枚举

```
'idle'         → 未发起推演，taskId 为 null
'connecting'   → 正在请求 REST + ticket
'connected'    → SSE 连接成功，接收事件中
'reconnecting' → SSE 断开，3秒后重试
```

## Mock 模式 vs 联调模式

`.env` 文件控制：
```
VITE_USE_MOCK=true     → mock 模式，各 service 走本地假数据
VITE_USE_MOCK=false    → 联调模式，走真实 API
```

mock 模式下 `getAnalysisTask` 返回的步骤里要有 RUNNING/WAITING 状态才能触发模拟动画。

## 已知特殊处理

1. **后端 `tool_call` 事件可能不包含 `stepId`**：代码已处理，无 `stepId` 的工具调用单独渲染，不挂靠特定步骤
2. **`CONFIRM` 按钮显示逻辑**：只推演动画跑完（`animCompleted`）但决策状态没变时（mock），`canConfirm` 也为 true 以便测试弹窗
3. **mock 数据 demo-1 状态需手动切换**：
   - `PENDING` → 待机测试
   - `WAITING_CONFIRM` → 确认弹窗测试
   - `COMPLETED` + `preferredOptionId` → 历史记录测试

## 工作规则

### 每次编码前必须按顺序读完这三份文件：

1. `docs/00-current-rules.md`
2. `docs/02-api-contract-v2.0.md`
3. `.cursor/rules/01-project.mdc`

**不读完这三份文件不允许动手。**

### 然后遵守以下规则：

- 严格按照文档里的规则和格式，不允许添加或修改任何主观的东西
- 分步实现，每一步确认后再下一步
- hook 里不加 mock 分支，保持单一真实数据路径
- resultReady / taskFailed 存完整对象，不只 boolean
- 每一阶段完成后 `npm run lint` 必须零报错
