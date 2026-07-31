import { create } from 'zustand'

const LEFT_DEFAULT = 220
const RIGHT_DEFAULT = 340
const THEME_KEY = 'ui-theme-mode'

export type ThemeMode = 'light' | 'eyeCare'

/** 布局硬约束：侧栏可拖，但必须给中间内容留出最小宽度 */
export const LAYOUT_LIMITS = {
  leftMin: 200,
  leftMax: 280,
  leftDefault: LEFT_DEFAULT,
  leftCollapsedWidth: 64,
  rightMin: 300,
  rightMax: 440,
  rightDefault: RIGHT_DEFAULT,
  /** 工作台中间画布最小可用宽度 */
  minCenterWidth: 380,
  /** 低于此宽度：自动收起左侧为图标栏 */
  narrowBreakpoint: 960,
  /** 低于此宽度：自动收起右侧推演栏 */
  compactBreakpoint: 1180,
} as const

function readStoredTheme(): ThemeMode {
  const raw = localStorage.getItem(THEME_KEY)
  return raw === 'eyeCare' ? 'eyeCare' : 'light'
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

interface LayoutUiState {
  leftCollapsed: boolean
  leftWidth: number
  rightCollapsed: boolean
  rightWidth: number
  /** 用户偏好：右侧展开；窄屏强制收起后，放宽窗口时按此恢复 */
  rightPreferOpen: boolean
  /** 用户偏好：左侧展开 */
  leftPreferOpen: boolean
  themeMode: ThemeMode
  setLeftCollapsed: (collapsed: boolean) => void
  setLeftWidth: (width: number) => void
  setRightCollapsed: (collapsed: boolean) => void
  setRightWidth: (width: number) => void
  /** 视口变化时钳制宽度，并在过窄时自动收起侧栏 */
  syncToViewport: (viewportWidth: number) => void
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
}

export const useLayoutStore = create<LayoutUiState>((set, get) => ({
  leftCollapsed: false,
  leftWidth: LEFT_DEFAULT,
  rightCollapsed: false,
  rightWidth: RIGHT_DEFAULT,
  rightPreferOpen: true,
  leftPreferOpen: true,
  themeMode: readStoredTheme(),
  setLeftCollapsed: (leftCollapsed) =>
    set({
      leftCollapsed,
      leftPreferOpen: !leftCollapsed,
    }),
  setLeftWidth: (leftWidth) =>
    set({
      leftWidth: clamp(
        leftWidth,
        LAYOUT_LIMITS.leftMin,
        LAYOUT_LIMITS.leftMax,
      ),
    }),
  setRightCollapsed: (rightCollapsed) =>
    set({
      rightCollapsed,
      rightPreferOpen: !rightCollapsed,
    }),
  setRightWidth: (rightWidth) =>
    set({
      rightWidth: clamp(
        rightWidth,
        LAYOUT_LIMITS.rightMin,
        LAYOUT_LIMITS.rightMax,
      ),
    }),
  syncToViewport: (viewportWidth) => {
    const state = get()
    const {
      leftMin,
      leftMax,
      rightMin,
      rightMax,
      leftCollapsedWidth,
      minCenterWidth,
      narrowBreakpoint,
      compactBreakpoint,
    } = LAYOUT_LIMITS

    const forceLeftCollapsed = viewportWidth < narrowBreakpoint
    const forceRightCollapsed = viewportWidth < compactBreakpoint

    const nextLeftCollapsed = forceLeftCollapsed ? true : !state.leftPreferOpen
    const nextRightCollapsed = forceRightCollapsed
      ? true
      : !state.rightPreferOpen

    const leftOccupied = nextLeftCollapsed
      ? leftCollapsedWidth
      : clamp(state.leftWidth, leftMin, leftMax)

    let nextLeftWidth = clamp(state.leftWidth, leftMin, leftMax)
    let nextRightWidth = clamp(state.rightWidth, rightMin, rightMax)

    if (!nextLeftCollapsed && !nextRightCollapsed) {
      const budget = viewportWidth - minCenterWidth - 12
      const totalSides = nextLeftWidth + nextRightWidth
      if (totalSides > budget && budget > leftMin + rightMin) {
        const scale = budget / totalSides
        nextLeftWidth = clamp(nextLeftWidth * scale, leftMin, leftMax)
        nextRightWidth = clamp(budget - nextLeftWidth, rightMin, rightMax)
      } else if (totalSides > budget) {
        nextLeftWidth = leftMin
        nextRightWidth = Math.max(rightMin, budget - leftMin)
      }
    } else if (!nextLeftCollapsed) {
      const maxLeft = Math.max(
        leftMin,
        viewportWidth - minCenterWidth - leftCollapsedWidth,
      )
      nextLeftWidth = clamp(nextLeftWidth, leftMin, Math.min(leftMax, maxLeft))
    } else if (!nextRightCollapsed) {
      const maxRight = Math.max(
        rightMin,
        viewportWidth - minCenterWidth - leftOccupied,
      )
      nextRightWidth = clamp(
        nextRightWidth,
        rightMin,
        Math.min(rightMax, maxRight),
      )
    }

    set({
      leftCollapsed: nextLeftCollapsed,
      rightCollapsed: nextRightCollapsed,
      leftWidth: nextLeftWidth,
      rightWidth: nextRightWidth,
    })
  },
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
