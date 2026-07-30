import { Empty, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PagePlaceholder } from '../../components/placeholders/PagePlaceholder'

/** 报告中心占位：后续对接报告列表 / GET report */
export function ReportCenterPage() {
  const navigate = useNavigate()

  return (
    <PagePlaceholder
      title="报告中心"
      description="查看已确认生成的正式决策报告。"
      hint="待接入 GET /reports/{id} 与决策报告列表"
    >
      <Empty
        description="暂无报告（占位）"
        style={{ padding: '48px 0' }}
      >
        <Button type="primary" onClick={() => navigate('/decisions')}>
          去决策记录
        </Button>
      </Empty>
    </PagePlaceholder>
  )
}
