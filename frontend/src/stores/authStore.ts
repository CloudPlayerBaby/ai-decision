import { create } from 'zustand'

const TOKEN_KEY = 'accessToken'

interface AuthUser {
  id: string
  username: string
  email: string
}

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

export const useAuthStore = create<AuthState>((set, get) => ({
  token: readStoredToken(),
  user: null,
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ token, user })
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, user: null })
  },
  isAuthenticated: () => Boolean(get().token),
}))
