package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 推演任务实体（对应 agent_run 表）
 */
@Data
@TableName("agent_run")
public class AnalysisTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 所属决策问题ID
     */
    private Long decisionId;

    /**
     * 推演类型：FULL（整轮）/ PARTIAL（局部重推）
     */
    private String runType;

    /**
     * 局部推演开始前的 Decision 状态，用于完成或失败后恢复正确状态。
     */
    private String previousDecisionStatus;

    /**
     * 任务状态：PENDING / RUNNING / SUCCEEDED / FAILED
     */
    private String status;

    /**
     * 当前步骤序号
     */
    private Integer currentStep;

    /**
     * 总步骤数
     */
    private Integer totalSteps;

    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;

    /**
     * 失败信息
     */
    private String errorMessage;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
