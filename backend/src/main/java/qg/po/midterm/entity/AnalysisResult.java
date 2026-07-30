package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 分析结果草案实体（API v2.0 4.2 节 + analysis_result 表）
 *
 * 每次 AI 推演通过结构校验后生成一条记录，status=PENDING_CONFIRM。
 * 用户确认后 status 变更为 CONFIRMED，同时生成正式报告。
 * 局部重推会产生新的 PENDING_CONFIRM 草案，旧草案不丢失。
 */
@Data
@TableName("analysis_result")
public class AnalysisResult {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属决策问题ID */
    private Long decisionId;

    /** 产生该结果的推演任务ID */
    private Long taskId;

    /**
     * 草案状态：PENDING_CONFIRM（待确认）/ CONFIRMED（已确认）
     */
    private String status;

    /**
     * 完整结构化分析结果（JSON）
     *
     * 包含：understanding, factors[], options[], recommendation,
     *       nextActions[], canvas, validation
     */
    private String resultData;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
