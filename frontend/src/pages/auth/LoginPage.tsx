import { Button, Card, Form, Input, Space, Typography, message, Tooltip } from 'antd'
import { BulbFilled, BulbOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { login } from '@/services/auth.service'
import { ApiError, BusinessCode } from '@/types/api'

const { Title, Paragraph } = Typography

interface LoginFormValues {
  account: string
  password: string
}

/** 登录页：POST /auth/login（account / password） */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const themeMode = useLayoutStore((state) => state.themeMode)
  const toggleThemeMode = useLayoutStore((state) => state.toggleThemeMode)
  const isEyeCare = themeMode === 'eyeCare'
  const [submitting, setSubmitting] = useState(false)

  // 进入登录页时清掉本地坏掉的 token，避免干扰重新登录
  useEffect(() => {
    clearSession()
  }, [clearSession])

  const fromState = (location.state as { from?: string } | null)?.from
  const fromQuery = searchParams.get('from')
  const from = fromState || fromQuery || '/decisions'

  const handleFinish = async (values: LoginFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const data = await login(values)
      setSession(data.accessToken, data.user)
      message.success('登录成功')
      navigate(from, { replace: true })
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === BusinessCode.Unauthorized
      ) {
        message.error(error.message || '账号或密码错误')
      }
      // 其他错误已由 http 拦截器提示
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__theme-toggle">
        <Tooltip title={isEyeCare ? '切换日间模式' : '切换护眼模式'}>
          <Button
            icon={isEyeCare ? <BulbFilled /> : <BulbOutlined />}
            onClick={toggleThemeMode}
          >
            {isEyeCare ? '日间模式' : '护眼模式'}
          </Button>
        </Tooltip>
      </div>

      <aside className="auth-page__brand">
        <div className="auth-page__brand-mark">NovaAI</div>
        <h1 className="auth-page__brand-title">开启智能决策空间</h1>
        <p className="auth-page__brand-desc">
          情景推演、方案对比与报告生成，一站完成关键决策。
        </p>
      </aside>

      <Card className="auth-page__card" variant="borderless">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={3}>欢迎回来</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              登录后继续你的决策推演
            </Paragraph>
          </div>
          <Form<LoginFormValues>
            layout="vertical"
            onFinish={handleFinish}
            requiredMark={false}
          >
            <Form.Item
              label="账号"
              name="account"
              rules={[{ required: true, message: '请输入用户名或邮箱' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="邮箱或用户名"
                autoComplete="username"
                size="large"
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
                size="large"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button
                className="auth-page__submit"
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
                disabled={submitting}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
          <Paragraph style={{ marginBottom: 0, textAlign: 'center' }}>
            还没有账号？{' '}
            <Link className="auth-page__link" to="/register">
              立即注册
            </Link>
          </Paragraph>
        </Space>
      </Card>
    </div>
  )
}
