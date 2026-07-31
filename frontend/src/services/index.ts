/**
 * Services 统一出口：A/B 组优先从此处 import，避免直接使用 Axios。
 */
export { isMockEnabled } from '@/services/config'
export { queryKeys } from '@/services/queryKeys'
export {
  http,
  getData,
  postData,
  putData,
  deleteData,
  requestData,
} from '@/services/http'

export * as authService from '@/services/auth.service'
export * as decisionService from '@/services/decision.service'
export * as analysisService from '@/services/analysis.service'
export * as canvasService from '@/services/canvas.service'
export * as reportService from '@/services/report.service'
