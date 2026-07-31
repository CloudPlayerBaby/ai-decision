package qg.po.midterm.dto.result;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 决策画布数据（API v2.0 第 10 节），独立于前端图形库内部模型。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "决策画布：节点与边")
public class Canvas {

    @Schema(description = "画布节点列表")
    private List<CanvasNode> nodes;

    @Schema(description = "画布边列表")
    private List<CanvasEdge> edges;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "画布节点")
    public static class CanvasNode {
        @Schema(description = "节点 ID")
        @NotBlank(message = "节点 id 不能为空")
        private String id;

        @Schema(description = "节点类型：decision / factor / option 等")
        @NotBlank(message = "节点 type 不能为空")
        private String type;

        @Schema(description = "展示标签")
        @NotBlank(message = "节点 label 不能为空")
        private String label;

        @Schema(description = "画布坐标")
        @NotNull(message = "节点 position 不能为空")
        @Valid
        private Position position;

        @Schema(description = "扩展数据（如 weight、scores）")
        private Map<String, Object> data;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "画布边")
    public static class CanvasEdge {
        @Schema(description = "边 ID")
        @NotBlank(message = "边 id 不能为空")
        private String id;

        @Schema(description = "起点节点 ID")
        @NotBlank(message = "边 source 不能为空")
        private String source;

        @Schema(description = "终点节点 ID")
        @NotBlank(message = "边 target 不能为空")
        private String target;

        @Schema(description = "关系类型，如 HAS_FACTOR")
        @NotBlank(message = "边 relation 不能为空")
        private String relation;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "二维坐标")
    public static class Position {
        private double x;
        private double y;
    }
}
