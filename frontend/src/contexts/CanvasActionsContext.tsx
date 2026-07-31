import { createContext, useContext } from 'react'

export interface CanvasActions {
  openOptionAnalysis: (nodeId: string) => void
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null)

export function useCanvasActions(): CanvasActions {
  const ctx = useContext(CanvasActionsContext)
  if (!ctx) {
    throw new Error('useCanvasActions must be used inside CanvasActionsContext.Provider')
  }
  return ctx
}
