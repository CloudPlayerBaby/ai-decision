import { Button, Card, Form, Input, Space, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PagePlaceholder } from '@/components/placeholders/PagePlaceholder'
import { createDecision } from '@/services/decision.service'
import { queryKeys } from '@/services/queryKeys'
import type { CreateDecisionRequest } from '@/types/decision'

const { TextArea } = Input

function isAbortError(error: unknown): boolean {
  return (
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_CANCELED') ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && /cancel|abort/i.test(error.message))
  )
}

/** 创建决策：constraints 为 string；成功后进入工作台 */
export function DecisionCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<CreateDecisionRequest>()
  const [submitting, setSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const mutation = useMutation({
    mutationFn: (values: CreateDecisionRequest) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      return createDecision(values, { signal: controller.signal })
    },
    onSuccess: async (data) => {
      abortRef.current = null
      message.success('决策已创建')
      await queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all })
      navigate(`/workbench/${data.id}`, { replace: true })
    },
    onError: (error) => {
      abortRef.current = null
      if (isAbortError(error)) return
    },
  })

  const handleFinish = async (values: CreateDecisionRequest) => {
    if (submitting || mutation.isPending) return
    setSubmitting(true)
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      if (!isAbortError(error)) {
        // 业务/网络错误已由 http 拦截器提示
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    // 提交中：只取消请求，保留表单内容，不离开页面
    if (submitting || mutation.isPending) {
      abortRef.current?.abort()
      abortRef.current = null
      mutation.reset()
      setSubmitting(false)
      message.info('已取消创建请求')
      return
    }
    navigate('/decisions')
  }

  return (
    <PagePlaceholder title="新建推演">
      <Card>
        <Form<CreateDecisionRequest>
          form={form}
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
            <TextArea rows={2} placeholder="约束条件（可选）" />
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
              <Button onClick={handleCancel}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PagePlaceholder>
  )
}
