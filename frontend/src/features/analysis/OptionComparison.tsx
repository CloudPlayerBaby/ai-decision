import { Tag, Rate, Button } from 'antd';
import { StarFilled } from '@ant-design/icons';
import type { DecisionOption, Recommendation } from '../../types/analysis';
import '../../styles/OptionComparison.css';

interface Props {
  options: DecisionOption[];
  recommendation: Recommendation;
  onSelect: (optionId: string) => void;
}

export function OptionComparison({ options, recommendation, onSelect }: Props) {
  return (
    <div className="option-comparison">
      <div className="option-comparison__title">📊 方案对比</div>
      <span className="option-comparison__reason">推荐理由：{recommendation.reason}</span>

      {options.map((option) => {
        const isRecommended = option.id === recommendation.optionId;

        return (
          <div key={option.id} className={`option-card${isRecommended ? ' is-recommended' : ''}`}>
            <div className="option-card__head">
              <span className="option-card__head-name">{option.name}</span>
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
              <div className="option-card__scores-row"><span className="option-card__scores-label">成本</span> <Rate disabled count={5} value={option.scores.cost} /></div>
              <div className="option-card__scores-row"><span className="option-card__scores-label">时间</span> <Rate disabled count={5} value={option.scores.time} /></div>
              <div className="option-card__scores-row"><span className="option-card__scores-label">收益</span> <Rate disabled count={5} value={option.scores.benefit} /></div>
              <div className="option-card__scores-row"><span className="option-card__scores-label">风险</span> <Rate disabled count={5} value={option.scores.risk} /></div>
              <div className="option-card__scores-row"><span className="option-card__scores-label">可行性</span> <Rate disabled count={5} value={option.scores.feasibility} /></div>
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
