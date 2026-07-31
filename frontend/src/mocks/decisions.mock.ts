import type {
  CreateDecisionRequest,
  CreateDecisionResponse,
  DecisionDetailResponse,
  DecisionListItem,
  DecisionListQuery,
  DecisionListResponse,
  DecisionProblem,
} from '@/types/decision'

const now = '2026-07-30T21:30:00+08:00'

export const MOCK_DECISIONS: DecisionProblem[] = [
  {
    id: 'demo-1',
    title: '一周 Java 面试复习安排',
    background: '我在准备 Java 后端面试。',
    goal: '一周内提升求职竞争力',
    constraints: '每天 2 小时，已有 Java 基础',
    status: 'PENDING',
    preferredOptionId: null,
    latestTaskId: null,
    hasPendingResult: false,
    pendingResultId: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-2',
    title: '毕业旅行预算规划',
    background: '想和同学毕业旅行。',
    goal: '在预算内安排 5 天行程',
    constraints: '人均预算 3000 元',
    status: 'COMPLETED',
    preferredOptionId: 'opt_docker',
    latestTaskId: null,
    hasPendingResult: false,
    pendingResultId: null,
    createdAt: '2026-07-28T10:00:00+08:00',
    updatedAt: '2026-07-28T18:00:00+08:00',
  },
  {
    id: 'demo-3',
    title: '小组项目方向选择',
    background: '课程项目选题。',
    goal: '两周内做出可演示原型',
    constraints: '三人小组，每人每周 8 小时',
    status: 'PENDING',
    preferredOptionId: null,
    latestTaskId: null,
    hasPendingResult: false,
    pendingResultId: null,
    createdAt: '2026-07-26T09:00:00+08:00',
    updatedAt: '2026-07-26T09:00:00+08:00',
  },
]

let mockStore = [...MOCK_DECISIONS]

export function resetDecisionMocks() {
  mockStore = [...MOCK_DECISIONS]
}

function toListItem(item: DecisionProblem): DecisionListItem {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    preferredOptionId: item.preferredOptionId,
    updatedAt: item.updatedAt,
    hasPendingResult: item.hasPendingResult,
  }
}

export function mockListDecisions(
  query: DecisionListQuery = {},
): DecisionListResponse {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 10
  let list = mockStore.map(toListItem)
  if (query.status) {
    list = list.filter((item) => item.status === query.status)
  }
  if (query.keyword) {
    const kw = query.keyword.toLowerCase()
    list = list.filter((item) => item.title.toLowerCase().includes(kw))
  }
  const total = list.length
  const start = (page - 1) * pageSize
  const pageList = list.slice(start, start + pageSize)
  return {
    list: pageList,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export function mockCreateDecision(
  body: CreateDecisionRequest,
): CreateDecisionResponse {
  const id = `d_${Date.now()}`
  const createdAt = new Date().toISOString()
  const problem: DecisionProblem = {
    id,
    title: body.title,
    background: body.background,
    goal: body.goal,
    constraints: body.constraints,
    status: 'PENDING',
    preferredOptionId: null,
    latestTaskId: null,
    hasPendingResult: false,
    pendingResultId: null,
    createdAt,
    updatedAt: createdAt,
  }
  mockStore = [problem, ...mockStore]
  return {
    id,
    status: problem.status,
    title: problem.title,
    createdAt,
  }
}

export function mockGetDecisionDetail(
  decisionId: string,
): DecisionDetailResponse {
  const decision =
    mockStore.find((item) => item.id === decisionId) ??
    ({
      ...MOCK_DECISIONS[0],
      id: decisionId,
      title: `决策 ${decisionId}`,
    } satisfies DecisionProblem)

  return {
    decision,
    latestTask: decision.latestTaskId
      ? {
          id: decision.latestTaskId,
          status:
            decision.status === 'ANALYZING' ||
            decision.status === 'PARTIAL_ANALYZING'
              ? 'RUNNING'
              : 'SUCCEEDED',
          progress:
            decision.status === 'ANALYZING' ||
            decision.status === 'PARTIAL_ANALYZING'
              ? 42
              : 100,
        }
      : null,
    confirmedResultId:
      decision.status === 'COMPLETED' ? 'ar_40001' : null,
    pendingResultId: decision.pendingResultId ?? null,
    reportId: decision.status === 'COMPLETED' ? `r_${decision.id}` : null,
  }
}

export function mockDeleteDecision(decisionId: string): null {
  const target = mockStore.find((item) => item.id === decisionId)
  if (
    target &&
    (target.status === 'ANALYZING' || target.status === 'PARTIAL_ANALYZING')
  ) {
    throw new Error('推演进行中，无法删除')
  }
  mockStore = mockStore.filter((item) => item.id !== decisionId)
  return null
}

export function mockStartFullAnalysis(decisionId: string) {
  const decision = mockStore.find((item) => item.id === decisionId)
  if (decision) {
    decision.status = 'ANALYZING'
    decision.latestTaskId = `t_${Date.now()}`
    decision.updatedAt = new Date().toISOString()
  }
  return {
    taskId: decision?.latestTaskId ?? `t_${Date.now()}`,
    decisionId,
    taskType: 'FULL_ANALYSIS' as const,
    status: 'RUNNING' as const,
    startedAt: new Date().toISOString(),
  }
}
