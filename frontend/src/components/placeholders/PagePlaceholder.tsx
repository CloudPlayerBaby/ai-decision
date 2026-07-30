import type { ReactNode } from 'react'
import { Card, Empty, Space, Typography } from 'antd'

const { Title, Paragraph, Text } = Typography

interface PagePlaceholderProps {
  title: string
  description: string
  hint?: string
  children?: ReactNode
}

export function PagePlaceholder({
  title,
  description,
  hint,
  children,
}: PagePlaceholderProps) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 8 }}>
          {title}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {description}
        </Paragraph>
        {hint ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {hint}
          </Text>
        ) : null}
      </div>
      {children ?? (
        <Card>
          <Empty description="功能占位，待接入业务逻辑" />
        </Card>
      )}
    </Space>
  )
}
