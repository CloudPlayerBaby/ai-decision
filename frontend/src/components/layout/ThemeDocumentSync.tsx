import { useEffect } from 'react'
import { useLayoutStore } from '../../stores/layoutStore'

/** 首屏前尽量同步一次，减少闪烁 */
const initial = localStorage.getItem('ui-theme-mode')
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme =
    initial === 'eyeCare' ? 'eye-care' : 'light'
}

/** 把主题同步到 <html data-theme>，供 CSS 变量与护眼样式使用 */
export function ThemeDocumentSync() {
  const themeMode = useLayoutStore((state) => state.themeMode)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeMode === 'eyeCare' ? 'eye-care' : 'light'
    root.style.colorScheme = themeMode === 'eyeCare' ? 'dark' : 'light'
  }, [themeMode])

  return null
}
