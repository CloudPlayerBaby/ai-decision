import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="请检查地址，或返回决策列表。"
      extra={
        <Button type="primary" onClick={() => navigate('/decisions')}>
          返回列表
        </Button>
      }
    />
  )
}
