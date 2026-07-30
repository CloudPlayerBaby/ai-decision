//axios 请求基础封装
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { message } from 'antd'
import { ApiError, BusinessCode, type ApiResponse } from '@/types/api'
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

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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
      message.error(payload.message || '登录已失效，请重新登录')
      redirectToLogin()
      return Promise.reject(
        new ApiError(payload.message || '未登录或 Token 失效', {
          code: BusinessCode.Unauthorized,
          httpStatus: response.status,
          data: payload.data,
        }),
      )
    }

    message.error(payload.message || '请求失败')
    return Promise.reject(
      new ApiError(payload.message || '请求失败', {
        code: payload.code,
        httpStatus: response.status,
        data: payload.data,
      }),
    )
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const payload = error.response?.data as ApiResponse<unknown> | undefined

      if (status === 401 || payload?.code === BusinessCode.Unauthorized) {
        message.error(payload?.message || '登录已失效，请重新登录')
        redirectToLogin()
        return Promise.reject(
          new ApiError(payload?.message || '未登录或 Token 失效', {
            code: BusinessCode.Unauthorized,
            httpStatus: status,
            data: payload?.data,
          }),
        )
      }

      const text =
        status === 404
          ? payload?.message || '记录不存在或无权访问'
          : payload?.message ||
            error.message ||
            (status ? `请求失败（HTTP ${status}）` : '网络异常，请稍后重试')
      if (status !== 401) {
        message.error(text)
      }
      return Promise.reject(
        new ApiError(text, {
          code: payload?.code ?? (status === 404 ? BusinessCode.NotFound : BusinessCode.ServerError),
          httpStatus: status,
          data: payload?.data,
        }),
      )
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
