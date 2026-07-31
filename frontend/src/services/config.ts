/** 业务层 Mock 开关：VITE_USE_MOCK=true 时走本地 Mock，便于无后端演示 */

export function isMockEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true'
}
