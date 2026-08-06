//axios 请求基础封装
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { message } from 'antd'
import { ApiError, BusinessCode, type BusinessCodeValue, type ApiResponse } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
  },
})

function redirectToLogin() {
  useAuthStore.getState().clearSession()
  const current = `${window.location.pathname}${window.location.search}`
  if (!window.location.pathname.startsWith('/login')) {
    const search = new URLSearchParams({ from: current })
    window.location.assign(`/login?${search.toString()}`)
  }
}
// 先判断是不是公开的登录和注册页面
/** 登录/注册不携带旧 Token，避免坏掉的 accessToken 干扰重新登录 */
function isAuthPublicRequest(config: InternalAxiosRequestConfig): boolean {
  const url = config.url ?? ''
  return url.includes('/auth/login') || url.includes('/auth/register')
}

function isAuthPage(): boolean {
  const path = window.location.pathname
  return path.startsWith('/login') || path.startsWith('/register')
}

/** 历史分析结果缺失时由页面自行处理，避免切换决策时刷屏 */
function isQuietNotFoundRequest(config?: InternalAxiosRequestConfig): boolean {
  const url = config?.url ?? ''
  return url.includes('/analysis-result')
}

/**
 * 退出登录 / 重新登录后，上一页（如工作台）发出的请求仍会返回。
 * 这类过期请求不应再弹全局 toast。
 */
function isStaleSessionRequest(config?: InternalAxiosRequestConfig): boolean {
  if (!config || isAuthPublicRequest(config)) return false

  const reqAuth = config.headers?.Authorization
  const currentToken = useAuthStore.getState().token

  if (typeof reqAuth === 'string') {
    return !currentToken || reqAuth !== `Bearer ${currentToken}`
  }

  return !currentToken || isAuthPage()
}

function rejectApiError(
  messageText: string,
  options: {
    code: BusinessCodeValue
    httpStatus?: number
    data?: unknown
  },
) {
  return Promise.reject(
    new ApiError(messageText, {
      code: options.code,
      httpStatus: options.httpStatus,
      data: options.data,
    }),
  )
}

function handleUnauthorized(
  messageText: string,
  config?: InternalAxiosRequestConfig,
  data?: unknown,
) {
  // 账号密码错误等：只提示，不清会话、不整页跳转
  if (config && isAuthPublicRequest(config)) {
    return rejectApiError(messageText, {
      code: BusinessCode.Unauthorized,
      httpStatus: 401,
      data,
    })
  }

  // 过期请求：退出登录、token 轮换后返回的 401，静默忽略
  if (isStaleSessionRequest(config)) {
    return rejectApiError(messageText, {
      code: BusinessCode.Unauthorized,
      httpStatus: 401,
      data,
    })
  }

  if (!isAuthPage()) {
    message.error(messageText)
  }
  redirectToLogin()
  return rejectApiError(messageText, {
    code: BusinessCode.Unauthorized,
    httpStatus: 401,
    data,
  })
}
// 避免 localStorage 里还有旧 token 时，登录请求也带上坏 token，干扰重新登录。
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isAuthPublicRequest(config)) {
    delete config.headers.Authorization
    return config
  }

  // 每次请求前从 Local Storage 同步，避免面板改 token 后仍带旧值
  const token = useAuthStore.getState().hydrateFromStorage()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.Authorization
  }
  return config
})

http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    const payload = response.data

    // 非统一包裹（如文件流）直接放行
    if (
      payload === null ||
      typeof payload !== 'object' ||
      !('code' in payload) ||
      !('message' in payload)
    ) {
      return response
    }

    if (payload.code === BusinessCode.Success) {
      return response
    }

    if (
      payload.code === BusinessCode.Unauthorized ||
      response.status === 401
    ) {
      return handleUnauthorized(
        payload.message || '登录已失效，请重新登录',
        response.config,
        payload.data,
      )
    }

    const messageText = payload.message || '请求失败'
    const suppressToast =
      isStaleSessionRequest(response.config) ||
      (payload.code === BusinessCode.NotFound &&
        isQuietNotFoundRequest(response.config))
    if (!suppressToast) {
      message.error(messageText)
    }
    return rejectApiError(messageText, {
      code: payload.code as BusinessCodeValue,
      httpStatus: response.status,
      data: payload.data,
    })
  },
  (error: unknown) => {
    // 用户主动取消请求：不弹错误
    if (axios.isCancel(error) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')) {
      return Promise.reject(error)
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const payload = error.response?.data as ApiResponse<unknown> | undefined

      if (status === 401 || payload?.code === BusinessCode.Unauthorized) {
        return handleUnauthorized(
          payload?.message || '登录已失效，请重新登录',
          error.config,
          payload?.data,
        )
      }

      const text =
        status === 404
          ? payload?.message || '记录不存在或无权访问'
          : payload?.message ||
            error.message ||
            (status ? `请求失败（HTTP ${status}）` : '网络异常，请稍后重试')
      if (
        status !== 401 &&
        !isStaleSessionRequest(error.config) &&
        !(status === 404 && isQuietNotFoundRequest(error.config))
      ) {
        message.error(text)
      }
      return rejectApiError(text, {
        code:
          (payload?.code as BusinessCodeValue) ??
          (status === 404 ? BusinessCode.NotFound : BusinessCode.ServerError),
        httpStatus: status,
        data: payload?.data,
      })
    }

    message.error('网络异常，请稍后重试')
    return Promise.reject(error)
  },
)

/** 取出统一响应中的 data；业务失败已在拦截器中拒绝 */
export async function requestData<T>(
  config: AxiosRequestConfig,
): Promise<T> {
  const response = await http.request<ApiResponse<T>>(config)
  return response.data.data
}

export async function getData<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return requestData<T>({ ...config, method: 'GET', url })
}

export async function postData<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return requestData<T>({ ...config, method: 'POST', url, data: body })
}

export async function putData<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return requestData<T>({ ...config, method: 'PUT', url, data: body })
}

export async function deleteData<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return requestData<T>({ ...config, method: 'DELETE', url })
}
