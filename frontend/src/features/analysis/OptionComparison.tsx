import { Tag, Rate } from 'antd';
import { StarFilled } from '@ant-design/icons';
import type { DecisionOption, Recommendation } from '../../types/analysis';
import '../../styles/OptionComparison.css';

interface Props {
  options: DecisionOption[];
  recommendation: Recommendation;
  /** 用户已选择的方案 ID（历史记录场景） */
  selectedOptionId?: string | null;
}

export function OptionComparison({ options, recommendation, selectedOptionId }: Props) {
  return (
    <div className="option-comparison">
      <div className="option-comparison__title">📊 方案对比</div>
      <span className="option-comparison__reason">推荐理由：{recommendation.reason}</span>

      {options.map((option) => {
        const isRecommended = option.id === recommendation.optionId;
        const isSelected = option.id === selectedOptionId;

        return (
          <div key={option.id} className={`option-card${isRecommended ? ' is-recommended' : ''}`}>
            <div className="option-card__head">
              <span className="option-card__head-name">{option.name}</span>
              {isRecommended && <Tag color="blue" icon={<StarFilled />}>推荐</Tag>}
              {isSelected && <Tag color="green">已选择</Tag>}
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
          </div>
        );
      })}
    </div>
  );
}
