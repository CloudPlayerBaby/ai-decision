import { deleteData, getData, postData } from '@/services/http'
import { isMockEnabled } from '@/services/config'
import {
  mockCreateDecision,
  mockDeleteDecision,
  mockGetDecisionDetail,
  mockListDecisions,
  mockStartFullAnalysis,
} from '@/mocks/decisions.mock'
import type {
  CreateDecisionRequest,
  CreateDecisionResponse,
  DecisionDetailResponse,
  DecisionListQuery,
  DecisionListResponse,
} from '@/types/decision'
import type { StartAnalysisResponse } from '@/types/analysis'

function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

export async function listDecisions(
  query: DecisionListQuery = {},
): Promise<DecisionListResponse> {
  if (isMockEnabled()) {
    return delay(mockListDecisions(query))
  }
  return getData<DecisionListResponse>('/decisions', { params: query })
}

export async function createDecision(
  body: CreateDecisionRequest,
  options?: { signal?: AbortSignal },
): Promise<CreateDecisionResponse> {
  if (isMockEnabled()) {
    return delay(mockCreateDecision(body))
  }
  return postData<CreateDecisionResponse>('/decisions', body, {
    signal: options?.signal,
  })
}

export async function getDecisionDetail(
  decisionId: string,
): Promise<DecisionDetailResponse> {
  if (isMockEnabled()) {
    return delay(mockGetDecisionDetail(decisionId))
  }
  return getData<DecisionDetailResponse>(`/decisions/${decisionId}`)
}

export async function deleteDecision(decisionId: string): Promise<null> {
  if (isMockEnabled()) {
    return delay(mockDeleteDecision(decisionId))
  }
  return deleteData<null>(`/decisions/${decisionId}`)
}

/** 发起整轮推演；工作台「开始推演」入口 */
export async function startFullAnalysis(
  decisionId: string,
): Promise<StartAnalysisResponse> {
  if (isMockEnabled()) {
    return delay(mockStartFullAnalysis(decisionId))
  }
  return postData<StartAnalysisResponse>(`/decisions/${decisionId}/analysis`)
}
