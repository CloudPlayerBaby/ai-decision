import { getData, postData } from '@/services/http'
import { isMockEnabled } from '@/services/config'
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from '@/types/auth'

function delay<T>(value: T, ms = 280): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

export async function register(body: RegisterRequest): Promise<AuthUser> {
  if (isMockEnabled()) {
    return delay({
      id: `u_${Date.now()}`,
      username: body.username,
      email: body.email,
      createdAt: new Date().toISOString(),
    })
  }
  return postData<AuthUser>('/auth/register', body)
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
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
  return postData<LoginResponse>('/auth/login', body)
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  if (isMockEnabled()) {
    return delay({
      id: 'u_mock_10001',
      username: 'mock_user',
      email: 'mock@example.com',
    })
  }
  return getData<AuthUser>('/users/me')
}
