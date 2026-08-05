/** 认证相关类型（对齐接口手册 v2.0 §5） */

export interface AuthUser {
  id: string
  username: string
  email: string
  createdAt?: string
}

/** 页面表单：用户输入明文密码 */
export interface RegisterPayload {
  username: string
  email: string
  password: string
}

export interface LoginPayload {
  account: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer' | string
  expiresIn: number
  user: AuthUser
}
