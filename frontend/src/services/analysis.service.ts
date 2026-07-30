import { getData, postData, putData } from '@/services/http'
import { isMockEnabled } from '@/services/config'
import { mockGetAnalysisResult } from '@/mocks/analysis-result.mock'
import {
  mockCreateSseTicket,
  mockGetAnalysisTask,
} from '@/mocks/tasks.mock'
import type {
  AnalysisResult,
  AnalysisTask,
  ConfirmAnalysisRequest,
  ConfirmAnalysisResponse,
  PartialAnalysisRequest,
  PartialAnalysisResponse,
  PreferredOptionRequest,
  RetryStepResponse,
  SseTicketResponse,
} from '@/types/analysis'

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

export async function getAnalysisTask(taskId: string): Promise<AnalysisTask> {
  if (isMockEnabled()) {
    return delay(mockGetAnalysisTask(taskId))
  }
  return getData<AnalysisTask>(`/analysis-tasks/${taskId}`)
}

export async function createSseTicket(
  taskId: string,
): Promise<SseTicketResponse> {
  if (isMockEnabled()) {
    return delay(mockCreateSseTicket(taskId))
  }
  return postData<SseTicketResponse>(`/analysis-tasks/${taskId}/sse-ticket`)
}

export async function retryFailedStep(
  taskId: string,
  stepId: string,
): Promise<RetryStepResponse> {
  if (isMockEnabled()) {
    return delay({
      taskId,
      stepId,
      status: 'WAITING' as const,
      message: '已加入重试队列',
    })
  }
  return postData<RetryStepResponse>(
    `/analysis-tasks/${taskId}/steps/${stepId}/retry`,
  )
}

/**
 * 获取分析结果。resultId 可选；无结果时后端返回 data: null。
 */
export async function getAnalysisResult(
  decisionId: string,
  resultId?: string | null,
): Promise<AnalysisResult | null> {
  if (isMockEnabled()) {
    return delay(mockGetAnalysisResult(resultId))
  }
  return getData<AnalysisResult | null>(
    `/decisions/${decisionId}/analysis-result`,
    { params: resultId ? { resultId } : undefined },
  )
}

export async function setPreferredOption(
  decisionId: string,
  body: PreferredOptionRequest,
): Promise<null> {
  if (isMockEnabled()) {
    return delay(null)
  }
  return putData<null>(`/decisions/${decisionId}/preferred-option`, body)
}

export async function confirmAnalysis(
  decisionId: string,
  body: ConfirmAnalysisRequest,
): Promise<ConfirmAnalysisResponse> {
  if (isMockEnabled()) {
    return delay({
      decisionId,
      status: 'COMPLETED' as const,
      analysisResultId: body.analysisResultId,
      reportId: `r_${decisionId}`,
      reportStatus: 'READY',
    })
  }
  return postData<ConfirmAnalysisResponse>(
    `/decisions/${decisionId}/confirm`,
    body,
  )
}

export async function startPartialAnalysis(
  decisionId: string,
  body: PartialAnalysisRequest,
): Promise<PartialAnalysisResponse> {
  if (isMockEnabled()) {
    return delay({
      taskId: `t_partial_${Date.now()}`,
      taskType: 'PARTIAL_ANALYSIS' as const,
      status: 'RUNNING' as const,
      affectedNodeIds: [...body.changedNodeIds, 'opt_redis'],
    })
  }
  return postData<PartialAnalysisResponse>(
    `/decisions/${decisionId}/partial-analysis`,
    body,
  )
}
