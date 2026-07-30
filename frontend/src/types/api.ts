/**
 * 统一 API 响应包裹（v2.0：{ code, message, data }）
 * 业务实体类型由各 feature / types 模块补充，此处仅放跨模块契约。
 */

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** 与接口文档 2.3 对齐的常见业务码 */
export const BusinessCode = {
  Success: 0,
  BadRequest: 40001,
  Unauthorized: 40101,
  NotFound: 40401,
  Conflict: 40901,
  ValidationFailed: 42201,
  ServerError: 50001,
} as const

export type BusinessCodeValue =
  (typeof BusinessCode)[keyof typeof BusinessCode]

export class ApiError extends Error {
  readonly code: number
  readonly httpStatus?: number
  readonly data: unknown

  constructor(
    message: string,
    options: { code: number; httpStatus?: number; data?: unknown } = {
      code: BusinessCode.ServerError,
    },
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code
    this.httpStatus = options.httpStatus
    this.data = options.data ?? null
  }
}
