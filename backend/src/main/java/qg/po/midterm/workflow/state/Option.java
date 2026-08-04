package qg.po.midterm.workflow.state;

import java.io.Serializable;

import java.util.Map;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(description = "候选决策方案")
public class Option implements Serializable {
    @Schema(description = "方案唯一标识")
    private String id;
    
    @Schema(description = "方案名称")
    private String name;
    
    @Schema(description = "方案详细描述")
    private String description;
    
    @Schema(description = "优点列表")
    private java.util.List<String> pros;

    @Schema(description = "缺点列表")
    private java.util.List<String> cons;

    @Schema(description = "风险列表")
    private java.util.List<String> risks;

    @Schema(description = "五维打分结果(cost, time, benefit, risk, feasibility)")
    private Map<String, Integer> scores;

    @Schema(description = "与此方案相关性最强的因素ID；无强相关时为空")
    private String relativeFactor;
}
