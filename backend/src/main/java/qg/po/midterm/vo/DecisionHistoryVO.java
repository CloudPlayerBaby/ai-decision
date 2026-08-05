package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 决策历史记录 VO：按推演任务分组，每组包含该次推演的所有步骤。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionHistoryVO {

    /** 任务 ID，格式 t_{id} */
    private String taskId;

    /** 推演类型：FULL（全量）/ PARTIAL（局部重推） */
    private String runType;

    /** 任务状态：RUNNING / SUCCEEDED / FAILED */
    private String taskStatus;

    /** 任务开始时间 */
    private OffsetDateTime startedAt;

    /** 任务结束时间 */
    private OffsetDateTime finishedAt;

    /** 关联的分析结果 ID，格式 ar_{id}（仅 SUCCEEDED 的任务有值） */
    private String analysisResultId;

    /** 该结果的状态：PENDING_CONFIRM / CONFIRMED */
    private String resultStatus;

    /** 本次推演的步骤列表（仅含 SUCCEEDED 的步骤，复用历史的步骤不展示） */
    private List<NodeProgressVO> steps;
}
