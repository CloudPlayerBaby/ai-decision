import { create } from 'zustand'

const LEFT_DEFAULT = 232
const RIGHT_DEFAULT = 360
const THEME_KEY = 'ui-theme-mode'

export type ThemeMode = 'light' | 'eyeCare'

function readStoredTheme(): ThemeMode {
  const raw = localStorage.getItem(THEME_KEY)
  return raw === 'eyeCare' ? 'eyeCare' : 'light'
}

interface LayoutUiState {
  leftCollapsed: boolean
  leftWidth: number
  rightCollapsed: boolean
  rightWidth: number
  themeMode: ThemeMode
  setLeftCollapsed: (collapsed: boolean) => void
  setLeftWidth: (width: number) => void
  setRightCollapsed: (collapsed: boolean) => void
  setRightWidth: (width: number) => void
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
}

export const useLayoutStore = create<LayoutUiState>((set, get) => ({
  leftCollapsed: false,
  leftWidth: LEFT_DEFAULT,
  rightCollapsed: false,
  rightWidth: RIGHT_DEFAULT,
  themeMode: readStoredTheme(),
  setLeftCollapsed: (leftCollapsed) => set({ leftCollapsed }),
  setLeftWidth: (leftWidth) => set({ leftWidth }),
  setRightCollapsed: (rightCollapsed) => set({ rightCollapsed }),
  setRightWidth: (rightWidth) => set({ rightWidth }),
  setThemeMode: (themeMode) => {
    localStorage.setItem(THEME_KEY, themeMode)
    set({ themeMode })
  },
  toggleThemeMode: () => {
    const next: ThemeMode = get().themeMode === 'light' ? 'eyeCare' : 'light'
    localStorage.setItem(THEME_KEY, next)
    set({ themeMode: next })
  },
}))

export const LAYOUT_LIMITS = {
  leftMin: 180,
  leftMax: 360,
  rightMin: 280,
  rightMax: 560,
  leftCollapsedWidth: 64,
} as const
