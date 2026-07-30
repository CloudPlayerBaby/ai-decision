import { Breadcrumb, Button, Space, Tag, Typography, Tooltip } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { DecisionCanvasPanel } from '../../components/workbench/DecisionCanvasPanel'
import { ConversationPanel } from '../../components/workbench/ConversationPanel'
import { ResizeHandle } from '../../components/layout/ResizeHandle'
import { LAYOUT_LIMITS, useLayoutStore } from '../../stores/layoutStore'

const { Title, Text } = Typography

const TITLE_MAP: Record<string, string> = {
  'demo-1': '一周 Java 面试复习安排',
  'demo-2': '毕业旅行预算规划',
  'demo-3': '小组项目方向选择',
}

/**
 * 决策工作台：中间画布 + 右侧推演对话（一体页，非分页面）。
 * 业务逻辑 / SSE / 保存确认待后续接入 services + React Query。
 */
export function DecisionDetailPage() {
  const { decisionId = '' } = useParams<{ decisionId: string }>()
  const title = TITLE_MAP[decisionId] ?? `决策 ${decisionId}`
  const rightCollapsed = useLayoutStore((state) => state.rightCollapsed)
  const rightWidth = useLayoutStore((state) => state.rightWidth)
  const setRightCollapsed = useLayoutStore((state) => state.setRightCollapsed)
  const setRightWidth = useLayoutStore((state) => state.setRightWidth)

  return (
    <div className="workbench">
      <header className="workbench__header">
        <div className="workbench__header-main">
          <Breadcrumb
            items={[
              { title: <Link to="/decisions">决策记录</Link> },
              { title: title },
            ]}
          />
          <Space align="center" wrap>
            <Title level={4} style={{ margin: 0 }}>
              {title}
            </Title>
            <Tag color="gold">待确认</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {decisionId}
            </Text>
          </Space>
        </div>
        <Space>
          <Tooltip title={rightCollapsed ? '展开推演对话' : '收起推演对话'}>
            <Button
              icon={
                rightCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
              }
              onClick={() => setRightCollapsed(!rightCollapsed)}
            />
          </Tooltip>
          <Button disabled>保存画布</Button>
          <Button type="primary" disabled>
            确认方案
          </Button>
        </Space>
      </header>

      <div className="workbench__body">
        <DecisionCanvasPanel />

        {!rightCollapsed ? (
          <>
            <ResizeHandle
              edge="west"
              value={rightWidth}
              onChange={setRightWidth}
              min={LAYOUT_LIMITS.rightMin}
              max={LAYOUT_LIMITS.rightMax}
              title="拖动调整右侧栏宽度（双击收起）"
              onDoubleClick={() => setRightCollapsed(true)}
            />
            <div
              className="workbench__right"
              style={{ width: rightWidth, flex: `0 0 ${rightWidth}px` }}
            >
              <ConversationPanel />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
