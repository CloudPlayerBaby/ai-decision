import { create } from 'zustand'
import type { AuthUser } from '@/types/auth'

const TOKEN_KEY = 'accessToken'
const USER_KEY = 'authUser'

export type { AuthUser }

interface AuthState {
  token: string | null
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void
  clearSession: () => void
  isAuthenticated: () => boolean
}
function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'username' in parsed &&
      'email' in parsed
    ) {
      const user = parsed as AuthUser
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

export const useAuthStore = create<AuthState>((set, get) => ({
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
  isAuthenticated: () => Boolean(get().token),
}))
