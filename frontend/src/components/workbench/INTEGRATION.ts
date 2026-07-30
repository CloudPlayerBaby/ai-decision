/**
 * A / B 合入说明（C 组 Day4 交付）
 *
 * ## 挂载点
 * - 中间画布：`DecisionCanvasPanel`（props 见 `workbenchContracts.ts`）
 * - 右侧推演台：`ConversationPanel`（同上）
 * - 工作台壳：`WorkbenchPage` 已注入 decisionId / taskId / pendingResultId
 *
 * ## 可 import 的 services（勿直接 Axios）
 * ```ts
 * import { canvasService, analysisService, queryKeys } from '@/services'
 * ```
 *
 * ## A 组接手
 * 1. 在 DecisionCanvasPanel 内调用 canvasService.getCanvas / saveCanvas
 * 2. 保存后用 changedNodeIds 调 analysisService.startPartialAnalysis
 * 3. 将返回的 taskId / affectedNodeIds 通过 onRequestRefresh 或 React Query 通知 B
 *
 * ## B 组接手
 * 1. 进入工作台：先用已有 taskId 调 analysisService.getAnalysisTask（C 已做）
 * 2. 再 analysisService.createSseTicket → EventSource(sseUrl)
 * 3. step_update：content 覆盖；result_ready：invalidate decisions.detail + analysis-result
 *
 * ## Mock
 * `.env` 中 `VITE_USE_MOCK=true` 可无后端演示主流程；联调时改为 `false`。
 */
export {}
