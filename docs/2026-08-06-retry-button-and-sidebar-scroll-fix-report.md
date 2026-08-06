# 重试按钮与侧边栏滚动修复报告

- 日期：2026-08-06
- 范围：前端推演对话、SSE 失败恢复、侧边栏滚动
- 状态：已修复并通过静态检查与生产构建

## 1. 问题现象

1. SSE 已收到 `task_failed`，接口数据也包含 `retryable=true` 和 `failedStepId`，但失败步骤没有展示“重试”按钮。
2. 首次推演失败后刷新页面，`GET /decisions/{decisionId}/history` 已返回失败任务历史，右侧推演对话仍然不可见。
3. 右侧推演对话首次打开或恢复历史时，滚动条没有默认定位到最新内容。

## 2. 根因

### 2.1 失败后整个步骤区域被隐藏

`task_failed` 处理器收到失败事件后会把连接状态设置为 `idle`。原页面仅在连接状态不是 `idle`，或者页面被识别成成功历史态时渲染推演内容。

首次推演失败后的决策状态为 `FAILED`，不属于原先定义的历史态。因此无论是实时失败还是刷新恢复，步骤已经存在于 React state 中，也会被外层渲染条件整体隐藏。

### 2.2 `task_failed` 与失败步骤状态存在事件时序窗口

后端失败流程会发送 `task_failed` 和状态为 `FAILED` 的 `step_update`。前端收到 `task_failed` 后立即关闭 EventSource，因此后续失败步骤更新可能无法到达。

“重试”按钮同时要求：

- `retryable=true`；
- 当前步骤 ID 等于 `failedStepId`；
- 当前步骤状态为 `FAILED`。

如果最后一条失败步骤更新丢失，按钮仍然缺少渲染条件。

### 2.3 刷新恢复被错误依赖于决策历史态

刷新后任务详情和任务历史都能正常返回失败步骤，但页面把“是否显示已有步骤”与 `isHistory` 绑定。`FAILED` 决策的 `isHistory=false`，导致已恢复的数据没有进入可见 UI。

## 3. 修复内容

### 3.1 SSE 失败状态即时恢复

修改 `frontend/src/hooks/useAnalysisStream.ts`：

- 为缺少 `taskId` 的 SSE 失败数据补上当前任务 ID；
- 收到 `task_failed` 后，立即将 `failedStepId` 对应步骤标记为 `FAILED`；
- 同步更新当前步骤分组的任务状态；
- 保留 `retryable` 和 `failedStepId`；
- 关闭 SSE 后重新查询一次任务详情，用持久化快照校准步骤内容、进度和错误信息；
- 即使快照查询失败，也保留 SSE 已恢复的即时失败状态，用户仍可重试。

### 3.2 失败和刷新历史始终可见

修改 `frontend/src/features/analysis/AnalysisChatPanel.tsx`：

- 推演内容改为在“已有步骤、已有历史结果或连接进行中”任一条件满足时展示；
- 不再使用 `connectionStatus !== idle` 作为已有步骤的可见性开关；
- 连接进入 `idle` 后停止展示“正在推演”动画；
- 存在失败步骤时，底部状态显示“推演失败”。

### 3.3 侧边栏默认滚动到底部

在推演对话滚动容器上增加滚动状态管理：

- 首次进入、切换决策、切换推演轮次或刷新恢复历史后，直接定位到最底部；
- 用户位于底部附近时，新 SSE 内容平滑跟随到底部；
- 用户主动向上查看历史、距离底部超过 64px 后，不再强制拉回底部；
- 没有监听打字机逐字动画，避免每个字符都触发滚动造成抖动。

## 4. 修复后的关键路径

### 实时失败

`task_failed` → 立即标记失败步骤 → 保存重试信息 → 页面在 `idle` 状态下仍展示步骤 → 生成“重试”按钮 → REST 快照校准。

### 刷新恢复

决策详情取得 `latestTaskId` → 任务历史恢复步骤 → 任务详情恢复 `retryable/failedStepId` → 即使决策状态为 `FAILED`，步骤仍然可见并可重试。

### 侧边栏滚动

首批可展示内容完成渲染 → 直接滚动到底部 → 后续内容仅在用户仍靠近底部时自动跟随。

## 5. 验证结果

| 检查项 | 结果 |
| --- | --- |
| `npm.cmd run lint` | 通过，退出码 0 |
| `npm.cmd run build` | 通过，TypeScript 与 Vite 生产构建成功 |
| `git diff --check` | 通过，无空白字符错误 |
| 新增 lint 告警 | 0 |

Lint 仍报告 18 条项目既有告警，均位于本次未修改的文件中，不影响本次构建。

## 6. 修改文件

- `frontend/src/hooks/useAnalysisStream.ts`
- `frontend/src/features/analysis/AnalysisChatPanel.tsx`
- `docs/2026-08-06-retry-button-and-sidebar-scroll-fix-report.md`

## 7. 未修改范围

- 未修改后端接口和数据库结构；
- 未修改 SSE 契约；
- 未改动现有任务历史接口；
- 未处理工作区中原有的其他未提交文件。
