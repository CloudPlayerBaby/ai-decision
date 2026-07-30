import { Button, Card, Form, Input, Space, Typography, message, Tooltip } from 'antd'
import { BulbFilled, BulbOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { register } from '@/services/auth.service'

const { Title, Paragraph } = Typography

interface RegisterFormValues {
  username: string
  email: string
  password: string
}

/** 注册页：POST /auth/register */
export function RegisterPage() {
  const navigate = useNavigate()
  const themeMode = useLayoutStore((state) => state.themeMode)
  const toggleThemeMode = useLayoutStore((state) => state.toggleThemeMode)
  const isEyeCare = themeMode === 'eyeCare'
  const [submitting, setSubmitting] = useState(false)

  const handleFinish = async (values: RegisterFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await register(values)
      message.success('注册成功，请登录')
      navigate('/login', { replace: true })
    } catch {
      // 错误已由 http 拦截器提示
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__theme-toggle">
        <Tooltip title={isEyeCare ? '切换日间模式' : '切换护眼夜间模式'}>
          <Button
            icon={isEyeCare ? <BulbFilled /> : <BulbOutlined />}
            onClick={toggleThemeMode}
          >
            {isEyeCare ? '日间模式' : '护眼模式'}
          </Button>
        </Tooltip>
      </div>
      <Card style={{ width: 400, maxWidth: '100%' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              注册
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              创建账号后开始决策推演
            </Paragraph>
          </div>
          <Form<RegisterFormValues>
            layout="vertical"
            onFinish={handleFinish}
            requiredMark={false}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                {
                  pattern: /^[A-Za-z0-9_]{3,30}$/,
                  message: '3–30 位字母、数字或下划线',
                },
              ]}
            >
              <Input placeholder="用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入合法邮箱' },
              ]}
            >
              <Input placeholder="email@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码至少 8 位' },
                {
                  pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/,
                  message: '需同时包含字母和数字',
                },
              ]}
            >
              <Input.Password
                placeholder="8–64 位，含字母和数字"
                autoComplete="new-password"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
                disabled={submitting}
              >
                注册
              </Button>
            </Form.Item>
          </Form>
          <Paragraph style={{ marginBottom: 0, textAlign: 'center' }}>
            已有账号？ <Link to="/login">登录</Link>
          </Paragraph>
        </Space>
      </Card>
    </div>
  )
}
