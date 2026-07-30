package qg.po.midterm.workflow.state;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@Schema(description = "影响决策的关键因素")
public class Factor {
    @Schema(description = "因素名称")
    private String name;
    @Schema(description = "因素描述")
    private String description;
    @Schema(description = "因素权重")
    private double weight;

    public Factor(String name, String description, double weight) {
        this.name = name;
        this.description = description;
        this.weight = weight;
    }
}
