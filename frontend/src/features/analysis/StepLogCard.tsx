import type { AnalysisStep, StepStatus } from "../../types/analysis";
import {ClockCircleOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined} from '@ant-design/icons'
import {Collapse, Button, Space} from 'antd'

interface Props{
  step:AnalysisStep;
  onRetry?: (stepId: string) => void;
}

function getIcon(status: StepStatus) {
  switch (status) {
    case "WAITING":
      return <ClockCircleOutlined style={{color:'#999'}}/>;
    case 'RUNNING':
      return <LoadingOutlined style={{color:'#1677ff'}}/>;
    case 'SUCCEEDED':
      return <CheckCircleOutlined style={{color:'#52c41a'}}/>;
    case 'FAILED':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  }
}

export function StepLogCard({step, onRetry}:Props) {
  return (
    <Collapse
      items={[{
        key:step.id,
        label:(
          <Space>
            {getIcon(step.status)}
            <span>{step.displayName} - {step.summary}</span>
            {step.status === 'FAILED' && onRetry && (
              <Button
                type="link"
                size="small"
                danger
                icon={<ReloadOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(step.id);
                }}
              >
                重试
              </Button>
            )}
          </Space>
        ),
        children:<p>{step.content}</p>
      }]}
    />

  )
}
