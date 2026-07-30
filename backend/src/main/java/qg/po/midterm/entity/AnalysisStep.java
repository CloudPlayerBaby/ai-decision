package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 推演步骤实体，对应 agent_step 表。
 */
@Data
@TableName("agent_step")
public class AnalysisStep {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long runId;
    private Integer stepOrder;
    private String stepName;
    private String stepType;
    private String toolName;
    private String status;
    private String inputData;
    private String outputData;
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private Integer retryCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
