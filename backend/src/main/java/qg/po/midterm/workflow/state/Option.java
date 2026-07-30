package qg.po.midterm.workflow.state;

import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@Schema(description = "候选决策方案")
public class Option {
    @Schema(description = "方案唯一标识")
    private String id;
    @Schema(description = "方案名称")
    private String name;
    @Schema(description = "方案详细描述")
    private String description;
    @Schema(description = "五维打分结果")
    private java.util.Map<String, Integer> scores;

    public Option(String id, String name, String description, Map<String, Integer> scores) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.scores = scores;
    }
}
