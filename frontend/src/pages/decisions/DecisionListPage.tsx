import {
  Button,
  Empty,
  Input,
  Select,
  Space,
  Table,
  message,
  Popconfirm,
} from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PagePlaceholder } from '@/components/placeholders/PagePlaceholder'
import { DecisionStatusTag } from '@/components/common/DecisionStatusTag'
import { listDecisions, deleteDecision } from '@/services/decision.service'
import { queryKeys } from '@/services/queryKeys'
import { isMockEnabled } from '@/services/config'
import type { DecisionListItem, DecisionStatus } from '@/types/decision'
import { ApiError, BusinessCode } from '@/types/api'

/** 决策记录列表：GET /decisions → 打开 /workbench/:id */
export function DecisionListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [status, setStatus] = useState<DecisionStatus | undefined>()

  const query = { page, pageSize, keyword: keyword || undefined, status }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.decisions.list(query),
    queryFn: () => listDecisions(query),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDecision,
    onSuccess: async () => {
      message.success('已删除')
      await queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === BusinessCode.Conflict) {
        message.error('推演进行中，无法删除')
      }
    },
  })

  return (
    <PagePlaceholder
      title="决策记录"
      description="查看历史推演记录，进入工作台继续分析。"
      wide
      hint={
        isMockEnabled()
          ? '当前为 Mock 数据（VITE_USE_MOCK=true）'
          : '已接入 GET /decisions'
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/decisions/new')}
        >
          新建推演
        </Button>
        <Input
          allowClear
          placeholder="搜索标题"
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onPressEnter={() => {
            setPage(1)
            setKeyword(keywordInput.trim())
          }}
        />
        <Select
          allowClear
          placeholder="状态筛选"
          style={{ width: 160 }}
          value={status}
          onChange={(value) => {
            setPage(1)
            setStatus(value)
          }}
          options={[
            { value: 'PENDING', label: '待分析' },
            { value: 'ANALYZING', label: '推演中' },
            { value: 'PARTIAL_ANALYZING', label: '局部推演中' },
            { value: 'WAITING_CONFIRM', label: '待确认' },
            { value: 'COMPLETED', label: '已完成' },
            { value: 'FAILED', label: '失败' },
          ]}
        />
        <Button
          onClick={() => {
            setPage(1)
            setKeyword(keywordInput.trim())
          }}
        >
          查询
        </Button>
      </Space>

      <Table<DecisionListItem>
        rowKey="id"
        loading={isLoading || isFetching}
        dataSource={data?.list ?? []}
        scroll={{ x: 720 }}
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
        columns={[
          { title: '标题', dataIndex: 'title' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 200,
            render: (value: DecisionStatus, row) => (
              <DecisionStatusTag
                status={value}
                hasPendingResult={row.hasPendingResult}
              />
            ),
          },
          { title: '更新时间', dataIndex: 'updatedAt', width: 200 },
          {
            title: '操作',
            width: 200,
            render: (_, row) => (
              <Space>
                <Button
                  type="link"
                  onClick={() => navigate(`/workbench/${row.id}`)}
                >
                  打开工作台
                </Button>
                <Popconfirm
                  title="确认删除该决策？"
                  description="物理删除后不可恢复"
                  onConfirm={() => deleteMutation.mutate(row.id)}
                >
                  <Button type="link" danger disabled={deleteMutation.isPending}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        locale={{ emptyText: <Empty description="暂无决策记录" /> }}
      />
    </PagePlaceholder>
  )
}
