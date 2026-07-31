package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 决策问题实体（API v2.0 4.1 节 + decision 表）
 */
@Data
@TableName("decision")
public class Decision {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 1–100 字 */
    private String title;

    /** 问题背景，最大 2000 字 */
    private String background;

    /** 决策目标，1–1000 字 */
    private String goal;

    /** 约束条件，自由文本 */
    private String constraints;

    /** 决策状态：PENDING / ANALYZING / PARTIAL_ANALYZING / WAITING_CONFIRM / COMPLETED / FAILED */
    private String status;

    /** 用户当前倾向方案ID */
    private String preferredOptionId;

    /** 最近一次推演任务ID */
    private Long latestTaskId;

    /** 是否存在待用户确认的新分析草案 */
    private Boolean hasPendingResult;

    /** 待确认草案的 analysis_result_id */
    private Long pendingResultId;

    /** 当前最新报告ID */
    private Long reportId;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
