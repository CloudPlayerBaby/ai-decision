package qg.po.midterm.workflow.state;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "影响决策的关键因素")
public class Factor {
    @Schema(description = "因素唯一标识")
    private String id;
    
    @Schema(description = "因素名称")
    private String name;
    
    @Schema(description = "因素描述")
    private String description;
    
    @Schema(description = "因素权重 (0-1)")
    private double weight;
}
