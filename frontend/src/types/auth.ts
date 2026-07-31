/** 认证相关类型（对齐接口手册 v2.0 §5） */

export interface AuthUser {
  id: string
  username: string
  email: string
  createdAt?: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginRequest {
  account: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer' | string
  expiresIn: number
  user: AuthUser
}
