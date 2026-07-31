import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppRouter } from '@/app/router'
import { useLayoutStore } from '@/stores/layoutStore'
import { ThemeDocumentSync } from '@/components/layout/ThemeDocumentSync'
import { LayoutViewportSync } from '@/components/layout/LayoutViewportSync'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
})

interface AppProvidersProps {
  children?: ReactNode
}

function ThemedApp({ children }: { children?: ReactNode }) {
  const themeMode = useLayoutStore((state) => state.themeMode)
  const isEyeCare = themeMode === 'eyeCare'

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isEyeCare
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
        token: isEyeCare
          ? {
              colorPrimary: '#6ea8fe',
              colorBgBase: '#1a1d24',
              colorBgContainer: '#22262f',
              colorBgElevated: '#2a303b',
              colorText: '#d7dde8',
              colorTextSecondary: '#9aa3b2',
              colorBorder: '#3a4150',
              borderRadius: 6,
              fontFamily:
                '"IBM Plex Sans", "Source Han Sans SC", "Noto Sans SC", system-ui, sans-serif',
            }
          : {
              colorPrimary: '#1f6feb',
              borderRadius: 6,
              fontFamily:
                '"IBM Plex Sans", "Source Han Sans SC", "Noto Sans SC", system-ui, sans-serif',
            },
      }}
    >
      <ThemeDocumentSync />
      <LayoutViewportSync />
      <AntApp>
        <BrowserRouter>{children ?? <AppRouter />}</BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedApp>{children}</ThemedApp>
    </QueryClientProvider>
  )
}
