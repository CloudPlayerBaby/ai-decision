import type { AnalysisStep, StepStatus } from "../../types/analysis";
import {ClockCircleOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined} from '@ant-design/icons'
import {Collapse} from 'antd'
interface Props{
  step:AnalysisStep
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

export function StepLogCard({step}:Props) {
  return (
    <Collapse
      items={[{
        key:step.id,
        label:<span>{getIcon(step.status)} {step.displayName} - {step.summary}</span>,
        children:<p>{step.content}</p>
      }]}
    />

  )
}
