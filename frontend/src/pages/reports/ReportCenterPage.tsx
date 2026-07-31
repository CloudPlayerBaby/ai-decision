import { Empty, Button, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PagePlaceholder } from '@/components/placeholders/PagePlaceholder'
import { listReports } from '@/services/report.service'
import { isMockEnabled } from '@/services/config'
import type { ReportListItem } from '@/types/report'

/** 报告中心：查看已确认生成的正式决策报告 */
export function ReportCenterPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'list'],
    queryFn: listReports,
  })

  return (
    <PagePlaceholder
      title="报告中心"
      description="查看已确认生成的正式决策报告。"
      wide
      hint={
        isMockEnabled()
          ? '当前 Mock 列表；真接口可从 COMPLETED 决策聚合 reportId'
          : 'GET /reports（若后端未提供列表则可能为空）'
      }
    >
      <Table<ReportListItem>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        scroll={{ x: 640 }}
        columns={[
          { title: '标题', dataIndex: 'title' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (status: string) => <Tag color="success">{status}</Tag>,
          },
          { title: '生成时间', dataIndex: 'generatedAt', width: 200 },
          {
            title: '操作',
            width: 160,
            render: (_, row) => (
              <Button type="link" onClick={() => navigate(`/reports/${row.id}`)}>
                查看报告
              </Button>
            ),
          },
        ]}
        locale={{ emptyText: <Empty description="暂无报告" /> }}
      />
    </PagePlaceholder>
  )
}
