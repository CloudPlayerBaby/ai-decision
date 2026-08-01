import type { ReactNode } from 'react'
import { Empty, Typography } from 'antd'

const { Title, Paragraph, Text } = Typography

interface PagePlaceholderProps {
  title: string
  description?: string
  hint?: string
  children?: ReactNode
  /** 更宽内容区（表格页） */
  wide?: boolean
}

/** 普通业务页壳：统一标题区 + 限宽内容，避免缩放时散乱 */
export function PagePlaceholder({
  title,
  description,
  hint,
  children,
  wide = false,
}: PagePlaceholderProps) {
  return (
    <div className={`page-shell${wide ? ' page-shell--wide' : ''}`}>
      <div className="page-shell__intro">
        <Title level={3} style={{ marginBottom: description || hint ? 8 : 0 }}>
          {title}
        </Title>
        {description ? (
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {description}
          </Paragraph>
        ) : null}
        {hint ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {hint}
          </Text>
        ) : null}
      </div>
      <div className="page-shell__body">
        {children ?? <Empty description="功能占位，待接入业务逻辑" />}
      </div>
    </div>
  )
}
