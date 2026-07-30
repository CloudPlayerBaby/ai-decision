import { Button, Card, Form, Input, Space, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PagePlaceholder } from '../../components/placeholders/PagePlaceholder'

const { TextArea } = Input

interface CreateDecisionFormValues {
  title: string
  background?: string
  goal: string
  /** v2.0：constraints 为 string，不是 string[] */
  constraints?: string
}

/**
 * 创建决策占位：字段对齐 POST /decisions（title / background / goal / constraints）。
 */
export function DecisionCreatePage() {
  const navigate = useNavigate()

  const handleFinish = (_values: CreateDecisionFormValues) => {
    message.info('创建表单占位提交成功（待接入 POST /decisions）')
    navigate('/decisions/demo-1')
  }

  return (
    <PagePlaceholder
      title="新建推演"
      description="填写决策背景、目标与约束，创建后进入决策工作台。"
      hint="constraints 为自由文本 string · 待接入 POST /decisions"
    >
      <Card>
        <Form<CreateDecisionFormValues>
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
              <Button type="primary" htmlType="submit">
                创建（占位）
              </Button>
              <Button onClick={() => navigate('/decisions')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PagePlaceholder>
  )
}
