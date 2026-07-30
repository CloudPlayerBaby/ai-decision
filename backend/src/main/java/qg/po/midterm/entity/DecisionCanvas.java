package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 决策画布实体（对应 decision_canvas 表）
 */
@Data
@TableName("decision_canvas")
public class DecisionCanvas {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属决策问题ID */
    private Long decisionId;

    /** 画布数据（JSON：完整 nodes + edges） */
    private String canvasData;

    /** 画布版本号 */
    private Integer version;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
