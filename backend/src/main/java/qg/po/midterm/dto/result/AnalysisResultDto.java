package qg.po.midterm.dto.result;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI 推演返回的规范化JSON结构（API v2.0 4.2 AnalysisResult）")
public class AnalysisResultDto implements Serializable {

    @Schema(description = "analysisResultId，用于选择倾向方案和最终确认", requiredMode = Schema.RequiredMode.REQUIRED)
    private String id;

    @Schema(description = "草案状态：PENDING_CONFIRM 或 CONFIRMED", requiredMode = Schema.RequiredMode.REQUIRED)
    private String status;

    @Schema(description = "对问题和目标的理解", requiredMode = Schema.RequiredMode.REQUIRED)
    private String understanding;

    @Schema(description = "关键因素列表", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<Factor> factors;

    @Schema(description = "候选方案列表 (2-3个)", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<Option> options;

    @Schema(description = "推荐方案及其理由", requiredMode = Schema.RequiredMode.REQUIRED)
    private Recommendation recommendation;

    @Schema(description = "下一步行动建议", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<String> nextActions;

    @Schema(description = "画布节点和边")
    private Canvas canvas;

    @Schema(description = "结构校验信息：schemaValid、repaired、warnings")
    private ValidationResult validation;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Recommendation implements Serializable {
        @Schema(description = "推荐方案的唯一ID")
        private String optionId;

        @Schema(description = "推荐理由")
        private String reason;
    }
}
