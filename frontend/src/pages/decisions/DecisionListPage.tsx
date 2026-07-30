import { Empty, Table, Tag, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PagePlaceholder } from '../../components/placeholders/PagePlaceholder'

const DEMO_ROWS = [
  {
    id: 'demo-1',
    title: 'Redis 与 Docker 的优先级',
    status: 'WAITING_CONFIRM',
    updatedAt: '2026-07-30',
  },
  {
    id: 'demo-2',
    title: '毕业旅行预算规划',
    status: 'COMPLETED',
    updatedAt: '2026-07-28',
  },
  {
    id: 'demo-3',
    title: '小组项目方向选择',
    status: 'PENDING',
    updatedAt: '2026-07-26',
  },
]

function statusTag(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    PENDING: { color: 'default', label: '待分析' },
    ANALYZING: { color: 'processing', label: '推演中' },
    PARTIAL_ANALYZING: { color: 'orange', label: '局部推演中' },
    WAITING_CONFIRM: { color: 'gold', label: '待确认' },
    COMPLETED: { color: 'success', label: '已完成' },
    FAILED: { color: 'error', label: '失败' },
  }
  const item = map[status] ?? { color: 'default', label: status }
  return <Tag color={item.color}>{item.label}</Tag>
}

/** 决策记录列表占位，点击进入一体工作台 */
export function DecisionListPage() {
  const navigate = useNavigate()

  return (
    <PagePlaceholder
      title="决策记录"
      description="查看历史推演记录，进入工作台继续分析。"
      hint="待接入 GET /decisions · 当前为占位数据"
    >
      <Table
        rowKey="id"
        dataSource={DEMO_ROWS}
        pagination={false}
        columns={[
          { title: '标题', dataIndex: 'title' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            render: (value: string) => statusTag(value),
          },
          { title: '更新时间', dataIndex: 'updatedAt', width: 140 },
          {
            title: '操作',
            width: 120,
            render: (_, row) => (
              <Button
                type="link"
                onClick={() => navigate(`/decisions/${row.id}`)}
              >
                打开工作台
              </Button>
            ),
          },
        ]}
        locale={{ emptyText: <Empty description="暂无决策记录" /> }}
      />
    </PagePlaceholder>
  )
}
