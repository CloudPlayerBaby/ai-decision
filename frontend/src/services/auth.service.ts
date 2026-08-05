import { getData, postData } from '@/services/http'
import { isMockEnabled } from '@/services/config'
import { useAuthStore } from '@/stores/authStore'
import { ApiError, BusinessCode } from '@/types/api'
import { encryptPassword } from '@/utils/rsaEncrypt'
import type {
  AuthUser,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
} from '@/types/auth'

function delay<T>(value: T, ms = 280): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

/** 用内置公钥加密，密文仍放在契约字段 password 中提交（后端需私钥解密） */
function toWirePassword(plainPassword: string): string {
  const encrypted = encryptPassword(plainPassword)
  if (!encrypted) {
    throw new Error('密码加密失败，请刷新页面后重试')
  }
  return encrypted
}

export async function register(body: RegisterPayload): Promise<AuthUser> {
  if (isMockEnabled()) {
    return delay({
      id: `u_${Date.now()}`,
      username: body.username,
      email: body.email,
      createdAt: new Date().toISOString(),
    })
  }
  return postData<AuthUser>('/auth/register', {
    username: body.username,
    email: body.email,
    password: toWirePassword(body.password),
  })
}

export async function login(body: LoginPayload): Promise<LoginResponse> {
  if (isMockEnabled()) {
    return delay({
      accessToken: `mock-token-${Date.now()}`,
      tokenType: 'Bearer',
      expiresIn: 7200,
      user: {
        id: 'u_mock_10001',
        username: body.account.includes('@')
          ? body.account.split('@')[0] || 'user'
          : body.account,
        email: body.account.includes('@')
          ? body.account
          : `${body.account}@example.com`,
      },
    })
  }
  return postData<LoginResponse>('/auth/login', {
    account: body.account,
    password: toWirePassword(body.password),
  })
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  if (isMockEnabled()) {
    const token = useAuthStore.getState().hydrateFromStorage()
    if (!token?.startsWith('mock-token-')) {
      throw new ApiError('未登录或 Token 失效', {
        code: BusinessCode.Unauthorized,
        httpStatus: 401,
      })
    }
    return delay({
      id: 'u_mock_10001',
      username: 'mock_user',
      email: 'mock@example.com',
    })
  }
  return getData<AuthUser>('/users/me')
}
