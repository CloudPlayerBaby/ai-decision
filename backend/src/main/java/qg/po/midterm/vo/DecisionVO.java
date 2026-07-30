package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 决策问题视图（API v2.0 4.1 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionVO {

    /** 对外ID，格式 "d_" + 数据库自增ID */
    private String id;

    private String title;
    private String background;
    private String goal;
    private String constraints;
    private String status;
    private String preferredOptionId;
    private String latestTaskId;
    private Boolean hasPendingResult;
    private String pendingResultId;
    private String createdAt;
    private String updatedAt;
}
