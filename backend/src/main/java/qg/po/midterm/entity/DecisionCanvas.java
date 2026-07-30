package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 决策画布数据库实体。
 *
 * <p>canvasData 保存前端提交的完整 nodes 和 edges。</p>
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
