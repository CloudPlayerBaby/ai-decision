import { Tag } from 'antd'
import type { DecisionStatus } from '@/types/decision'

const STATUS_META: Record<
  DecisionStatus,
  { color: string; label: string }
> = {
  PENDING: { color: 'default', label: '待分析' },
  ANALYZING: { color: 'processing', label: '推演中' },
  PARTIAL_ANALYZING: { color: 'orange', label: '局部推演中' },
  WAITING_CONFIRM: { color: 'gold', label: '待确认' },
  COMPLETED: { color: 'success', label: '已完成' },
  FAILED: { color: 'error', label: '失败' },
}

interface DecisionStatusTagProps {
  status: DecisionStatus | string
  hasPendingResult?: boolean
}

/** 统一决策状态标签；COMPLETED + 待确认草案时追加提示 */
export function DecisionStatusTag({
  status,
  hasPendingResult,
}: DecisionStatusTagProps) {
  const meta = STATUS_META[status as DecisionStatus] ?? {
    color: 'default',
    label: status,
  }

  return (
    <>
      <Tag color={meta.color}>{meta.label}</Tag>
      {hasPendingResult ? <Tag color="warning">新草案待确认</Tag> : null}
    </>
  )
}
