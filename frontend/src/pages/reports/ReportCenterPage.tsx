import { Empty, Button, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PagePlaceholder } from '@/components/placeholders/PagePlaceholder'
import { listReports } from '@/services/report.service'
import type { ReportListItem } from '@/types/report'
import { formatDateTime } from '@/utils/formatDate'

/** 报告中心：查看已确认生成的正式决策报告 */
export function ReportCenterPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'list', page, pageSize],
    queryFn: () => listReports({ page, pageSize }),
  })

  return (
    <PagePlaceholder title="报告中心" wide>
      <Table<ReportListItem>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.list ?? []}
        pagination={{
          current: data?.page ?? page,
          pageSize: data?.pageSize ?? pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage)
            setPageSize(nextSize)
          },
        }}
        scroll={{ x: 640 }}
        columns={[
          { title: '标题', dataIndex: 'title' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: () => <Tag color="success">finish</Tag>,
          },
          {
            title: '生成时间',
            dataIndex: 'generatedAt',
            width: 180,
            render: (value: string) => formatDateTime(value),
          },
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
