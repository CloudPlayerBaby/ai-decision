import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  List,
  Result,
  Space,
  Spin,
  Typography,
  message,
} from 'antd'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  getDecisionReport,
  getReport,
  regenerateReport,
} from '@/services/report.service'
import { queryKeys } from '@/services/queryKeys'
import { ApiError, BusinessCode } from '@/types/api'
import { isMockEnabled } from '@/services/config'
import { formatDateTime } from '@/utils/formatDate'

const { Paragraph, Text, Title } = Typography

function isReportId(id: string): boolean {
  return id.startsWith('r_')
}

/** 报告详情：GET /reports/{reportId} 或 GET /decisions/{id}/report */
export function ReportDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const reportQuery = useQuery({
    queryKey: isReportId(id)
      ? queryKeys.reports.detail(id)
      : queryKeys.decisions.report(id),
    queryFn: () => (isReportId(id) ? getReport(id) : getDecisionReport(id)),
    enabled: Boolean(id),
    retry: (count, error) => {
      if (error instanceof ApiError && error.code === BusinessCode.NotFound) {
        return false
      }
      return count < 1
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () => {
      const decisionId = reportQuery.data?.decisionId ?? id.replace(/^r_/, '')
      return regenerateReport(decisionId)
    },
    onSuccess: async (data) => {
      message.success('报告已重新生成')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.reports.detail(data.id),
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.report(data.decisionId),
      })
      if (data.id !== id) {
        navigate(`/reports/${data.id}`, { replace: true })
      }
    },
  })

  if (reportQuery.isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" description="加载报告…" />
      </div>
    )
  }

  if (reportQuery.isError || !reportQuery.data) {
    const err = reportQuery.error
    const is404 =
      err instanceof ApiError &&
      (err.code === BusinessCode.NotFound || err.httpStatus === 404)
    return (
      <Result
        status={is404 ? '404' : 'error'}
        title={is404 ? '记录不存在或无权访问' : '报告加载失败'}
        subTitle="报告仅在用户确认草案后生成；不以流式文本作为正式报告。"
        extra={
          <Button type="primary" onClick={() => navigate('/reports')}>
            返回报告中心
          </Button>
        }
      />
    )
  }

  const report = reportQuery.data
  const content = report.content

  return (
    <div>
      <PageHeader
        className="page-header page-header--padded"
        breadcrumb={[
          { title: <Link to="/reports">报告中心</Link> },
          { title: report.title ?? '决策报告' },
        ]}
        title={report.title ?? '决策报告'}
        description={
          isMockEnabled() ? (
            <Text type="secondary">当前 Mock 模式</Text>
          ) : undefined
        }
        extra={
          <Space>
            <Button onClick={() => navigate(`/workbench/${report.decisionId}`)}>
              返回工作台
            </Button>
            <Button
              type="primary"
              loading={regenerateMutation.isPending}
              disabled={regenerateMutation.isPending}
              onClick={() => regenerateMutation.mutate()}
            >
              重新生成报告
            </Button>
          </Space>
        }
      />
      <div style={{ padding: '0 24px 24px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="正式报告由已确认的 AnalysisResult 生成"
            description="重新生成仅刷新展示内容，不会重新调用分析 Agent。若需重新分析，请回工作台发起整轮推演。"
          />
          <Card>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="状态">finish</Descriptions.Item>
              <Descriptions.Item label="生成时间">
                {formatDateTime(report.generatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="背景">
            <Paragraph style={{ marginBottom: 0 }}>{content.background}</Paragraph>
          </Card>
          <Card title="目标">
            <Paragraph style={{ marginBottom: 0 }}>{content.objective}</Paragraph>
          </Card>
          <Card title="因素分析">
            {Array.isArray(content.factorAnalysis) &&
            content.factorAnalysis.length > 0 ? (
              <List
                dataSource={content.factorAnalysis}
                renderItem={(item, index) => {
                  const row = item as { name?: string; summary?: string }
                  return (
                    <List.Item>
                      <Text>
                        {row.name ?? `因素 ${index + 1}`}
                        {row.summary ? `：${row.summary}` : ''}
                      </Text>
                    </List.Item>
                  )
                }}
              />
            ) : (
              <Empty description="暂无因素分析" />
            )}
          </Card>
          <Card title="方案对比">
            {Array.isArray(content.optionComparison) &&
            content.optionComparison.length > 0 ? (
              <List
                dataSource={content.optionComparison}
                renderItem={(item, index) => {
                  const row = item as {
                    name?: string
                    optionId?: string
                    score?: number
                  }
                  return (
                    <List.Item>
                      <Text>
                        {row.name ?? row.optionId ?? `方案 ${index + 1}`}
                        {typeof row.score === 'number' ? `（评分 ${row.score}）` : ''}
                      </Text>
                    </List.Item>
                  )
                }}
              />
            ) : (
              <Empty description="暂无方案对比" />
            )}
          </Card>
          <Card title="结论">
            <Title level={5} style={{ marginTop: 0 }}>
              {content.conclusion}
            </Title>
          </Card>
          <Card title="风险分析">
            <List
              dataSource={content.riskAnalysis.map(String)}
              renderItem={(item) => <List.Item>{item}</List.Item>}
              locale={{ emptyText: '暂无风险项' }}
            />
          </Card>
          <Card title="下一步行动">
            <List
              dataSource={content.nextActions}
              renderItem={(item) => <List.Item>{item}</List.Item>}
              locale={{ emptyText: '暂无行动建议' }}
            />
          </Card>
        </Space>
      </div>
    </div>
  )
}
