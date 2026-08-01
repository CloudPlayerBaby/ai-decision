import { Modal, Radio, Space, Typography, Alert, List, Tag, Button } from 'antd'
import { useEffect, useState } from 'react'
import type { AnalysisResult } from '@/types/analysis'

const { Text, Paragraph } = Typography

interface ConfirmResultModalProps {
  open: boolean
  loading?: boolean
  result: AnalysisResult | null
  preferredOptionId?: string | null
  onCancel: () => void
  onConfirm: (selectedOptionId: string) => void
}

/** 确认待确认草案：必须携带 analysisResultId + selectedOptionId */
export function ConfirmResultModal({
  open,
  loading,
  result,
  preferredOptionId,
  onCancel,
  onConfirm,
}: ConfirmResultModalProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string>('')

  useEffect(() => {
    if (!result) {
      setSelectedOptionId('')
      return
    }
    setSelectedOptionId(
      preferredOptionId ||
        result.recommendation.optionId ||
        result.options[0]?.id ||
        '',
    )
  }, [result, preferredOptionId, open])

  return (
    <Modal
      title="确认方案并生成报告"
      open={open}
      onCancel={onCancel}
      // 不用 confirmLoading：antd 在 confirmLoading 时会吞掉取消/关闭
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            loading={loading}
            disabled={!selectedOptionId || !result}
            onClick={() => {
              if (!selectedOptionId) return
              onConfirm(selectedOptionId)
            }}
          >
            确认并生成报告
          </Button>
        </Space>
      }
      destroyOnHidden
      width={640}
      mask={{ closable: !loading }}
      keyboard={!loading}
    >
      {!result ? (
        <Alert type="info" showIcon message="暂无待确认分析结果" />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="确认后将生成正式报告"
            description="请核对下方方案后确认；确认后该结果将成为正式结论并生成报告。"
          />
          {loading ? (
            <Alert
              type="info"
              showIcon
              message="正在生成报告，可点「取消」关闭并中止本次请求"
            />
          ) : null}
          <div>
            <Text strong>问题理解</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {result.understanding}
            </Paragraph>
          </div>
          <div>
            <Text strong>推荐</Text>
            <Paragraph style={{ marginBottom: 0 }}>
              {result.recommendation.reason}
            </Paragraph>
          </div>
          <Radio.Group
            value={selectedOptionId}
            onChange={(e) => setSelectedOptionId(e.target.value as string)}
            style={{ width: '100%' }}
            disabled={loading}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {result.options.map((option) => (
                <Radio
                  key={option.id}
                  value={option.id}
                  style={{
                    width: '100%',
                    border: '1px solid var(--ant-color-border)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <Space direction="vertical" size={4}>
                    <Space>
                      <Text strong>{option.name}</Text>
                      {option.id === result.recommendation.optionId ? (
                        <Tag color="blue">推荐</Tag>
                      ) : null}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      成本 {option.scores.cost} · 时间 {option.scores.time} ·
                      收益 {option.scores.benefit} · 风险 {option.scores.risk} ·
                      可行 {option.scores.feasibility}
                    </Text>
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
          <List
            size="small"
            header={<Text strong>下一步行动</Text>}
            dataSource={result.nextActions}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Space>
      )}
    </Modal>
  )
}
