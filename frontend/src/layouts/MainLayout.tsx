import { Layout, Menu, Button, Typography, Space, theme, Tooltip } from 'antd'
import {
  ApartmentOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  PlusOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { LAYOUT_LIMITS, useLayoutStore } from '@/stores/layoutStore'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { listDecisions } from '@/services/decision.service'
import { queryKeys } from '@/services/queryKeys'

const { Sider, Content } = Layout
const { Text, Title } = Typography

export function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const leftCollapsed = useLayoutStore((state) => state.leftCollapsed)
  const leftWidth = useLayoutStore((state) => state.leftWidth)
  const themeMode = useLayoutStore((state) => state.themeMode)
  const setLeftCollapsed = useLayoutStore((state) => state.setLeftCollapsed)
  const setLeftWidth = useLayoutStore((state) => state.setLeftWidth)
  const toggleThemeMode = useLayoutStore((state) => state.toggleThemeMode)
  const { token } = theme.useToken()
  const isEyeCare = themeMode === 'eyeCare'

  const recentQuery = useQuery({
    queryKey: queryKeys.decisions.list({ page: 1, pageSize: 5 }),
    queryFn: () => listDecisions({ page: 1, pageSize: 5 }),
    staleTime: 60_000,
  })
  const recentDecisions = recentQuery.data?.list ?? []
  const workbenchTarget = recentDecisions[0]?.id
    ? `/workbench/${recentDecisions[0].id}`
    : '/decisions'

  const isWorkbench = location.pathname.startsWith('/workbench')

  let selectedKey = '/decisions'
  if (location.pathname.startsWith('/reports')) {
    selectedKey = '/reports'
  } else if (isWorkbench) {
    selectedKey = '/workbench'
  } else if (location.pathname.startsWith('/decisions')) {
    selectedKey = '/decisions'
  }

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  const themeToggleButton = (
    <Tooltip
      title={isEyeCare ? '切换日间模式' : '切换护眼夜间模式'}
      placement="right"
    >
      <Button
        type="text"
        size="small"
        icon={isEyeCare ? <BulbFilled /> : <BulbOutlined />}
        onClick={toggleThemeMode}
        aria-label={isEyeCare ? '切换日间模式' : '切换护眼夜间模式'}
      >
        {leftCollapsed ? null : isEyeCare ? '日间' : '护眼'}
      </Button>
    </Tooltip>
  )

  return (
    <Layout style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <div className="app-sider-shell">
        <Sider
          collapsible
          collapsed={leftCollapsed}
          onCollapse={setLeftCollapsed}
          collapsedWidth={LAYOUT_LIMITS.leftCollapsedWidth}
          width={leftWidth}
          theme={isEyeCare ? 'dark' : 'light'}
          trigger={null}
          style={{
            borderRight: 'none',
            height: '100%',
            overflow: 'hidden',
            background: token.colorBgContainer,
          }}
        >
          <div className={`app-sider${leftCollapsed ? ' is-collapsed' : ''}`}>
            <div className="app-sider__brand">
              <ThunderboltOutlined
                style={{ color: token.colorPrimary, fontSize: 18 }}
              />
              {!leftCollapsed ? (
                <Title level={5} style={{ margin: 0 }}>
                  决策引擎
                </Title>
              ) : null}
            </div>

            <Tooltip
              title={leftCollapsed ? '新建推演' : undefined}
              placement="right"
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                block={!leftCollapsed}
                onClick={() => navigate('/decisions/new')}
                style={{ marginBottom: 16 }}
              >
                {leftCollapsed ? null : '新建推演'}
              </Button>
            </Tooltip>

            {!leftCollapsed ? (
              <Text type="secondary" className="app-sider__section-label">
                工作空间
              </Text>
            ) : null}
            <Menu
              mode="inline"
              theme={isEyeCare ? 'dark' : 'light'}
              inlineCollapsed={leftCollapsed}
              selectedKeys={[selectedKey]}
              style={{ border: 'none', background: 'transparent' }}
              items={[
                {
                  key: '/workbench',
                  icon: <ApartmentOutlined />,
                  label: leftCollapsed ? (
                    '决策工作台'
                  ) : (
                    <Link to={workbenchTarget}>决策工作台</Link>
                  ),
                  onClick: leftCollapsed
                    ? () => navigate(workbenchTarget)
                    : undefined,
                },
                {
                  key: '/decisions',
                  icon: <UnorderedListOutlined />,
                  label: leftCollapsed ? (
                    '决策记录'
                  ) : (
                    <Link to="/decisions">决策记录</Link>
                  ),
                  onClick: leftCollapsed
                    ? () => navigate('/decisions')
                    : undefined,
                },
                {
                  key: '/reports',
                  icon: <FileTextOutlined />,
                  label: leftCollapsed ? (
                    '报告中心'
                  ) : (
                    <Link to="/reports">报告中心</Link>
                  ),
                  onClick: leftCollapsed
                    ? () => navigate('/reports')
                    : undefined,
                },
              ]}
            />

            {!leftCollapsed ? (
              <>
                <Text type="secondary" className="app-sider__section-label">
                  最近决策
                </Text>
                <div className="app-sider__recent">
                  {recentDecisions.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      暂无最近决策
                    </Text>
                  ) : (
                    recentDecisions.map((item) => {
                      const active =
                        location.pathname === `/workbench/${item.id}`
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`app-sider__recent-item${active ? ' is-active' : ''}`}
                          onClick={() => navigate(`/workbench/${item.id}`)}
                        >
                          {item.title}
                        </button>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="app-sider__recent app-sider__recent--spacer" />
            )}

            <div className="app-sider__footer">
              {leftCollapsed ? (
                <Space direction="vertical" size={4} align="center">
                  {themeToggleButton}
                  <Tooltip title="退出登录" placement="right">
                    <Button
                      type="text"
                      icon={<LogoutOutlined />}
                      onClick={handleLogout}
                    />
                  </Tooltip>
                </Space>
              ) : (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space
                    style={{ width: '100%', justifyContent: 'space-between' }}
                  >
                    <Text ellipsis style={{ maxWidth: 120 }}>
                      {user?.username ?? '用户'}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<LogoutOutlined />}
                      onClick={handleLogout}
                    />
                  </Space>
                  {themeToggleButton}
                </Space>
              )}
            </div>
          </div>
        </Sider>

        {!leftCollapsed ? (
          <ResizeHandle
            edge="east"
            value={leftWidth}
            onChange={setLeftWidth}
            min={LAYOUT_LIMITS.leftMin}
            max={LAYOUT_LIMITS.leftMax}
            title="拖动调整左侧栏宽度（双击收起）"
            onDoubleClick={() => setLeftCollapsed(true)}
          />
        ) : null}

        <button
          type="button"
          className={`sider-collapse-btn${leftCollapsed ? ' is-collapsed' : ''}`}
          aria-label={leftCollapsed ? '展开决策引擎' : '收起决策引擎'}
          title={leftCollapsed ? '展开决策引擎' : '收起决策引擎'}
          onClick={() => setLeftCollapsed(!leftCollapsed)}
        >
          {leftCollapsed ? '›' : '‹'}
        </button>
      </div>

      <Content
        className={
          isWorkbench ? 'app-content app-content--workbench' : 'app-content'
        }
      >
        <Outlet />
      </Content>
    </Layout>
  )
}
