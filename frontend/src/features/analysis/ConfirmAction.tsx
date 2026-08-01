import { Button, Result, Typography } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import '../../styles/ConfirmAction.css';

const { Text } = Typography;

interface Props {
  selectedOptionId: string;
  analysisResultId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmAction({ selectedOptionId, onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-action">
      <Result
        icon={<CheckCircleOutlined style={{ color: '#1677ff' }} />}
        title="确认方案"
        subTitle={
          <Text>
            已选择 <Text strong>{selectedOptionId}</Text>
          </Text>
        }
        extra={[
          <Button key="cancel" onClick={onCancel}>
            重新选择
          </Button>,
          <Button key="confirm" type="primary" onClick={onConfirm}>
            确认生成报告
          </Button>,
        ]}
      />
    </div>
  );
}
