package qg.po.midterm.dto.result;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 报告内容结构化对象（API v2.0 11.1 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportContent {

    /** 决策背景 */
    private String background;

    /** 决策目标 */
    private String objective;

    /** 关键因素分析 */
    private List<FactorItem> factorAnalysis;

    /** 候选方案对比 */
    private List<OptionComparison> optionComparison;

    /** 最终结论 */
    private String conclusion;

    /** 风险分析 */
    private List<String> riskAnalysis;

    /** 下一步行动建议 */
    private List<String> nextActions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FactorItem {
        private String name;
        private Double weight;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionComparison {
        private String name;
        private List<String> pros;
        private List<String> cons;
        private List<String> risks;
        private Map<String, Integer> scores;
    }
}
