import type { AnalysisTask, SseTicketResponse } from '@/types/analysis'

export const MOCK_ANALYSIS_TASK: AnalysisTask = {
  id: 't_30001',
  status: 'RUNNING',
  progress: 42,
  lastEventId: 'evt_102',
  steps: [
    {
      id: 's_1',
      name: 'UNDERSTAND',
      displayName: '理解问题',
      status: 'SUCCEEDED',
      summary: '已识别学习路径与时间约束',
      content:
        '你只有一周时间准备 Java 后端面试，每天 2 小时，共 14 小时可用。核心矛盾在于有限时间内是追求覆盖面还是单点深度。',
      startedAt: '2026-07-30T21:31:00+08:00',
      endedAt: '2026-07-30T21:31:20+08:00',
    },
    {
      id: 's_2',
      name: 'EXTRACT_FACTORS',
      displayName: '提取关键因素',
      status: 'RUNNING',
      summary: '正在分析时间、收益与风险',
      content:
        '关键因素包括：时间成本（每天仅 2 小时）、求职收益（面试高频度）、项目实践（能否形成可验证成果）。',
      startedAt: '2026-07-30T21:31:20+08:00',
    },
    {
      id: 's_3',
      name: 'TOOL_CALL',
      displayName: '工具调用',
      status: 'WAITING',
      summary: '等待前序步骤完成',
      content: '',
    },
    {
      id: 's_4',
      name: 'GENERATE_OPTIONS',
      displayName: '生成候选方案',
      status: 'WAITING',
      summary: '等待前序步骤完成',
      content: '',
    },
    {
      id: 's_5',
      name: 'COMPARE_OPTIONS',
      displayName: '方案对比',
      status: 'WAITING',
      summary: '等待前序步骤完成',
      content: '',
    },
  ],
}

export function mockGetAnalysisTask(taskId: string): AnalysisTask {
  return { ...MOCK_ANALYSIS_TASK, id: taskId }
}

export function mockCreateSseTicket(taskId: string): SseTicketResponse {
  return {
    sseUrl: `/api/v1/analysis-tasks/${taskId}/events?ticket=sse_tk_mock`,
    expiresIn: 60,
  }
}
