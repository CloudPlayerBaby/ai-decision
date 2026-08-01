import { Button, Card, Form, Input, Space, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PagePlaceholder } from '@/components/placeholders/PagePlaceholder'
import { createDecision } from '@/services/decision.service'
import { queryKeys } from '@/services/queryKeys'
import type { CreateDecisionRequest } from '@/types/decision'

const { TextArea } = Input

/** 创建决策：constraints 为 string；成功后进入工作台 */
export function DecisionCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)

  const mutation = useMutation({
    mutationFn: createDecision,
    onSuccess: async (data) => {
      message.success('决策已创建')
      await queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all })
      navigate(`/workbench/${data.id}`, { replace: true })
    },
  })

  const handleFinish = async (values: CreateDecisionRequest) => {
    if (submitting || mutation.isPending) return
    setSubmitting(true)
    try {
      await mutation.mutateAsync(values)
    } catch {
      // http 已提示
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PagePlaceholder title="新建推演">
      <Card>
        <Form<CreateDecisionRequest>
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
          style={{ maxWidth: 640 }}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[
              { required: true, message: '请输入标题' },
              { max: 100, message: '标题最多 100 字' },
            ]}
          >
            <Input placeholder="例如：我应该优先学习 Redis 还是 Docker？" />
          </Form.Item>
          <Form.Item
            label="背景"
            name="background"
            rules={[{ max: 2000, message: '背景最多 2000 字' }]}
          >
            <TextArea rows={3} placeholder="问题背景（可选）" />
          </Form.Item>
          <Form.Item
            label="目标"
            name="goal"
            rules={[
              { required: true, message: '请输入决策目标' },
              { max: 1000, message: '目标最多 1000 字' },
            ]}
          >
            <TextArea rows={2} placeholder="希望达成的决策目标" />
          </Form.Item>
          <Form.Item
            label="约束条件"
            name="constraints"
            extra="自由文本，例如：每天 2 小时，已有 Java 基础"
          >
            <TextArea rows={2} placeholder="约束条件（可选，string）" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting || mutation.isPending}
                disabled={submitting || mutation.isPending}
              >
                创建并进入工作台
              </Button>
              <Button onClick={() => navigate('/decisions')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PagePlaceholder>
  )
}
