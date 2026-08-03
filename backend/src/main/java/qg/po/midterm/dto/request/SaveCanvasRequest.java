package qg.po.midterm.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import qg.po.midterm.dto.result.Canvas;

import java.util.List;

/**
 * 保存画布编辑请求（API v2.0 10.2 节）
 */
@Data
public class SaveCanvasRequest {

    /**
     * 完整画布节点列表
     */
    @NotNull(message = "nodes 不能为空")
    private List<@Valid Canvas.CanvasNode> nodes;

    /**
     * 完整画布边列表
     */
    @NotNull(message = "edges 不能为空")
    private List<@Valid Canvas.CanvasEdge> edges;
}
