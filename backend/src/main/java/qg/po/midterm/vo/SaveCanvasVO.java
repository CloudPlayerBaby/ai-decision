package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import qg.po.midterm.dto.result.Canvas;

/**
 * 保存画布响应（API v2.0 10.2 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaveCanvasVO {

    /** 变更的节点ID列表 */
    private java.util.List<String> changedNodeIds;

    /** 保存后的完整画布 */
    private Canvas canvas;
}
