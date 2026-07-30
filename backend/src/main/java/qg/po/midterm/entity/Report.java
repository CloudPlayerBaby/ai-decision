package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 决策报告实体（对应 decision_report 表）
 */
@Data
@TableName("decision_report")
public class Report {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属决策问题ID */
    private Long decisionId;

    /** 报告内容（JSON：背景、目标、方案对比、推荐结论、下一步行动等） */
    private String content;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
