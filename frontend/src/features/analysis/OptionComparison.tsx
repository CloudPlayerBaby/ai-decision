import { Tag, Rate, Button, Typography } from 'antd';
import { StarFilled } from '@ant-design/icons';
import type { DecisionOption, Recommendation } from '../../types/analysis';
import '../../styles/OptionComparison.css';

const { Text } = Typography;

interface Props {
  options: DecisionOption[];
  recommendation: Recommendation;
  onSelect: (optionId: string) => void;
}

export function OptionComparison({ options, recommendation, onSelect }: Props) {
  return (
    <div className="option-comparison">
      <div className="option-comparison__title">📊 方案对比</div>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 12, display: 'block' }}>
        推荐理由：{recommendation.reason}
      </Text>

      {options.map((option) => {
        const isRecommended = option.id === recommendation.optionId;

        return (
          <div key={option.id} className={`option-card${isRecommended ? ' is-recommended' : ''}`}>
            <div className="option-card__head">
              <Text strong>{option.name}</Text>
              {isRecommended && <Tag color="blue" icon={<StarFilled />}>推荐</Tag>}
            </div>

            <ul className="option-card__list option-card__list--pros">
              {option.pros.map((item, i) => <li key={i}>✅ {item}</li>)}
            </ul>
            <ul className="option-card__list option-card__list--cons">
              {option.cons.map((item, i) => <li key={i}>❌ {item}</li>)}
            </ul>
            <ul className="option-card__list option-card__list--risks">
              {option.risks.map((item, i) => <li key={i}>⚠️ {item}</li>)}
            </ul>

            <div className="option-card__scores">
              <div><Text type="secondary">成本</Text> <Rate disabled count={5} value={option.scores.cost} /></div>
              <div><Text type="secondary">时间</Text> <Rate disabled count={5} value={option.scores.time} /></div>
              <div><Text type="secondary">收益</Text> <Rate disabled count={5} value={option.scores.benefit} /></div>
              <div><Text type="secondary">风险</Text> <Rate disabled count={5} value={option.scores.risk} /></div>
              <div><Text type="secondary">可行性</Text> <Rate disabled count={5} value={option.scores.feasibility} /></div>
            </div>

            <Button
              type={isRecommended ? 'primary' : 'default'}
              block
              size="small"
              onClick={() => onSelect(option.id)}
            >
              {isRecommended ? '采纳推荐' : '选择此方案'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
