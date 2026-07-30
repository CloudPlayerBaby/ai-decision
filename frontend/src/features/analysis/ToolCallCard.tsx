import type { ToolCallEvent } from "../../types/analysis";
import { ToolOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import '../../styles/ToolCallCard.css'
interface Props{
    toolCall:ToolCallEvent;
}

function getStatusColor(status:ToolCallEvent['status']){
    switch (status){
        case 'WAITING':
            return 'default';
        case 'RUNNING':
            return 'processing';
        case 'SUCCEEDED':
            return 'success';
        case 'FAILED':
            return 'error';
    }

}
function getStatusText(status:ToolCallEvent['status']){
    switch (status){
        case 'WAITING':
            return '等待中';
        case 'RUNNING':
            return '执行中';
        case 'SUCCEEDED':
            return '已完成';
        case 'FAILED':
            return '失败';
    }

}
export function ToolCallCard({toolCall}:Props){
    return (
    <div className="tool-call-card">
      <div className="header">
        <ToolOutlined style={{ color: '#1677ff' }} />
        <span className="tool-name">{toolCall.toolName}</span>
        <Tag color={getStatusColor(toolCall.status)} className="tag">
          {getStatusText(toolCall.status)}
        </Tag>
      </div>
      <div className="body">
        <div>入参: {toolCall.inputSummary}</div>
        <div>结果: {toolCall.outputSummary}</div>
      </div>
    </div>
  );
}