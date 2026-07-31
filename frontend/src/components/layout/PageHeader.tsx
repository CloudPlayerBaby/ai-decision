import type { ReactNode } from 'react'
import { Breadcrumb, Typography } from 'antd'
import type { BreadcrumbProps } from 'antd'

const { Title, Text } = Typography

interface PageHeaderProps {
  title: ReactNode
  breadcrumb?: BreadcrumbProps['items']
  extra?: ReactNode
  status?: ReactNode
  description?: ReactNode
  className?: string
}

/** 全局页面顶栏：面包屑 + 标题 + 右侧操作（可换行，避免缩放挤爆） */
export function PageHeader({
  title,
  breadcrumb,
  extra,
  status,
  description,
  className,
}: PageHeaderProps) {
  return (
    <header className={className ?? 'page-header'}>
      <div className="page-header__main">
        {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
        <div className="page-header__title-row">
          {typeof title === 'string' ? (
            <Title level={4} style={{ margin: 0 }} title={title}>
              {title}
            </Title>
          ) : (
            title
          )}
          {status}
        </div>
        {description ? (
          typeof description === 'string' ? (
            <Text type="secondary">{description}</Text>
          ) : (
            description
          )
        ) : null}
      </div>
      {extra ? <div className="page-header__extra">{extra}</div> : null}
    </header>
  )
}
