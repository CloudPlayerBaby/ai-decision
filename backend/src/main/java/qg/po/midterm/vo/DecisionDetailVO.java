package qg.po.midterm.vo;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 决策问题详情视图（API v2.0 6.3 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DecisionDetailVO {

    private DecisionVO decision;

    private LatestTaskSummary latestTask;

    /** 已确认的分析结果ID，格式 "ar_" + 自增ID */
    private String confirmedResultId;

    /** 待确认的分析结果ID，格式 "ar_" + 自增ID */
    private String pendingResultId;

    /** 最新报告ID，格式 "r_" + 自增ID */
    private String reportId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LatestTaskSummary {
        private String id;
        private String status;
        private Integer progress;
    }
}
