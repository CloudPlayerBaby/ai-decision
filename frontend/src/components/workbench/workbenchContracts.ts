/**
 * 工作台三栏挂载契约（C 提供壳，A/B 填内容）
 *
 * - decisionId：路由 /workbench/:id
 * - taskId：来自详情 latestTaskId 或「开始推演」返回
 * - pendingResultId / hasPendingResult：待确认草案
 * - onTaskStarted / onResultConfirmed：刷新 React Query 缓存信号
 */

export interface WorkbenchSlotProps {
  decisionId: string
  taskId?: string | null
  pendingResultId?: string | null
  hasPendingResult?: boolean
  decisionStatus?: string
  onRequestRefresh?: () => void  //abc的通信组件
}
