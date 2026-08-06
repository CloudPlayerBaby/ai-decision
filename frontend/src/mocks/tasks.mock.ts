import type { AnalysisTask, SseTicketResponse, TaskHistoryItem } from '@/types/analysis'

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

export const MOCK_TASK_HISTORY: TaskHistoryItem[] = [
  {
    taskId: 't_30001',
    runType: 'FULL',
    taskStatus: 'SUCCEEDED',
    analysisResultId: 'ar_40001',
    resultStatus: 'PENDING_CONFIRM',
    startedAt: '2026-07-31T09:00:00+08:00',
    finishedAt: '2026-07-31T09:02:34+08:00',
    steps: [
      {
        id: 's_1',
        name: 'UNDERSTAND',
        displayName: '理解问题',
        status: 'SUCCEEDED',
        summary: '根据背景信息，理解决策目标',
        content: '你正在面临一个关于…的决策，核心目标是…',
      },
      {
        id: 's_2',
        name: 'EXTRACT_FACTORS',
        displayName: '提取关键因素',
        status: 'SUCCEEDED',
        summary: '已提取 4 个关键因素',
        content: '提取了以下关键决策因素：成本、时间、风险、可行性…',
      },
      {
        id: 's_3',
        name: 'GENERATE_OPTIONS',
        displayName: '生成候选方案',
        status: 'SUCCEEDED',
        summary: '生成了 3 个候选方案',
        content: '基于决策目标，生成了以下候选方案…',
      },
      {
        id: 's_4',
        name: 'COMPARE_OPTIONS',
        displayName: '比较候选方案',
        status: 'SUCCEEDED',
        summary: '评估与对比完成',
        content: '综合五维评分，推荐方案 A，理由是…',
      },
    ],
  },
]

export function mockGetTaskHistory(_decisionId: string): TaskHistoryItem[] {
  return MOCK_TASK_HISTORY
}
