import { create } from 'zustand'
import type { AuthUser } from '@/types/auth'

const TOKEN_KEY = 'accessToken'
const USER_KEY = 'authUser'

export type { AuthUser }
//用户信息类型
interface AuthState {
  token: string | null
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void//登录成功后调用。存数据，跳转首页
  clearSession: () => void//退出登录时调用。清数据，跳转登录页。
  /** 以 Local Storage 为准同步内存（DevTools 改 token 后立刻生效） */
  hydrateFromStorage: () => string | null//刷新时把内容记住
  isAuthenticated: () => boolean
}
//从localstorage中读取token
function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)//后端给的数据json
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)//类型收窄
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'username' in parsed &&
      'email' in parsed
    ) {
      const user = parsed as AuthUser//先进行断言
      if (
        typeof user.id === 'string' &&
        typeof user.username === 'string' &&
        typeof user.email === 'string'
      ) {
        return user
      }
    }
    return null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({//创建状态仓库
  token: readStoredToken(),
  user: readStoredUser(),
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ token, user })
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ token: null, user: null })
  },
  hydrateFromStorage: () => {// “从硬盘重新加载数据到内存”。
    const token = readStoredToken()
    const user = readStoredUser()
    const current = get()
    const userChanged =
      (current.user?.id ?? null) !== (user?.id ?? null) ||
      (current.user?.username ?? null) !== (user?.username ?? null) ||
      (current.user?.email ?? null) !== (user?.email ?? null)
    if (current.token !== token || userChanged) {
      set({ token, user })
    }
    return token
  },
  isAuthenticated: () => Boolean(get().token),
}))
