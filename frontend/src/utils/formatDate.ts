import dayjs from 'dayjs'

/** 展示用时间：2026-08-01 19:20 */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : value
}
