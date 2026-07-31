import { useState } from 'react'
import { Breadcrumb, Button, Space, Tag, Typography, Tooltip, message } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { DecisionCanvasPanel } from '../../components/workbench/DecisionCanvasPanel'
import { ConversationPanel } from '../../components/workbench/ConversationPanel'
import { ResizeHandle } from '../../components/layout/ResizeHandle'
import { LAYOUT_LIMITS, useLayoutStore } from '../../stores/layoutStore'
import type { CanvasData } from '../../types/canvas'

const { Title, Text } = Typography

const TITLE_MAP: Record<string, string> = {
  'demo-1': '一周 Java 面试复习安排',
  'demo-2': '毕业旅行预算规划',
  'demo-3': '小组项目方向选择',
}

/**
 * 决策工作台：中间画布 + 右侧推演对话（一体页，非分页面）。
 */
export function DecisionDetailPage() {
  const { decisionId = '' } = useParams<{ decisionId: string }>()
  const title = TITLE_MAP[decisionId] ?? `决策 ${decisionId}`

  // 画布脏标记和最新数据
  const [isDirty, setIsDirty] = useState(false)
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null)

  // 布局状态
  const rightCollapsed = useLayoutStore((state) => state.rightCollapsed)
  const rightWidth = useLayoutStore((state) => state.rightWidth)
  const setRightCollapsed = useLayoutStore((state) => state.setRightCollapsed)
  const setRightWidth = useLayoutStore((state) => state.setRightWidth)

  /**
   * 保存画布（待 C 接入 services）
   *
   * TODO(C): 接入 services.saveCanvas(canvasData)
   * - 发送完整 nodes + edges 至 /decisions/{id}/canvas
   * - 成功后 setIsDirty(false)
   * - 从响应中提取 changedNodeIds，传递给 ConversationPanel
   */
  const handleSaveCanvas = async () => {
    // TODO(C): 接入后删除此临时提示
    message.info('保存服务待 C 接入 services 层后实现')
  }

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
            <Tag color="gold">
              {canvasData && isDirty ? '已修改' : '待确认'}
            </Tag>
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
          <Tooltip title="保存服务待 C 接入 services 层后可用">
            <Button disabled={!isDirty} onClick={handleSaveCanvas}>
              保存画布
            </Button>
          </Tooltip>
          <Button type="primary" disabled>
            确认方案
          </Button>
        </Space>
      </header>

      <div className="workbench__body">
        <DecisionCanvasPanel
          onDirtyChange={setIsDirty}
          onCanvasChange={setCanvasData}
        />

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
              <ConversationPanel decisionId={decisionId} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
