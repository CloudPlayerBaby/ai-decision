package qg.po.midterm.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI 推演返回的规范化JSON结构")
public class AnalysisResultDto {

    @Schema(description = "对问题和目标的理�?, required = true)
    private String understanding;

    @Schema(description = "关键因素列表", required = true)
    private List<Factor> factors;

    @Schema(description = "候选方案列�?(2-3�?", required = true)
    private List<Option> options;

    @Schema(description = "推荐方案及其理由", required = true)
    private Recommendation recommendation;

    @Schema(description = "下一步行动建�?, required = true)
    private List<String> nextActions;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Recommendation {
        @Schema(description = "推荐方案的唯一ID")
        private String optionId;
        
        @Schema(description = "推荐理由")
        private String reason;
    }
}
