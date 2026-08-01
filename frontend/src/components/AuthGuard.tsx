import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/stores/authStore'
import { fetchCurrentUser } from '@/services/auth.service'

interface AuthGuardProps {
  children: ReactNode
}

type GuardStatus = 'checking' | 'ok' | 'unauthenticated'

/**
 * 受保护路由：本地有 token 还不够，必须校验会话有效。
 * 改坏 / 过期 token 后应踢回登录页。
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const token = useAuthStore((state) => state.token)
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage)
  const clearSession = useAuthStore((state) => state.clearSession)
  const setSession = useAuthStore((state) => state.setSession)
  const location = useLocation()
  const [status, setStatus] = useState<GuardStatus>('checking')
  const validatedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      const latestToken = hydrateFromStorage()
      if (!latestToken) {
        validatedTokenRef.current = null
        if (!cancelled) setStatus('unauthenticated')
        return
      }

      // 已对同一 token 校验通过：切路由时不再打 /users/me
      if (validatedTokenRef.current === latestToken) {
        if (!cancelled) setStatus('ok')
        return
      }

      if (!cancelled) setStatus('checking')

      try {
        const user = await fetchCurrentUser()
        if (cancelled) return
        validatedTokenRef.current = latestToken
        setSession(latestToken, user)
        setStatus('ok')
      } catch {
        if (cancelled) return
        validatedTokenRef.current = null
        clearSession()
        setStatus('unauthenticated')
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [
    token,
    location.pathname,
    hydrateFromStorage,
    clearSession,
    setSession,
  ])

  if (status === 'unauthenticated' || !token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (status === 'checking') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Spin size="large" description="正在校验登录状态…" />
      </div>
    )
  }

  return children
}
