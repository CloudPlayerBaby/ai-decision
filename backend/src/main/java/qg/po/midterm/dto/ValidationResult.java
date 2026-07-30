package qg.po.midterm.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "结构化校验反�?)
public class ValidationResult {

    @Schema(description = "结果是否有效（通过所有结构和业务校验�?)
    private boolean schemaValid;

    @Schema(description = "是否经历了自动修复并修复成功")
    private boolean repaired;

    @Schema(description = "缺失的必填字段列表（用于返回给AI进行修复�?)
    private List<String> missingFields;

    @Schema(description = "校验警告信息（非致命错误�?)
    private List<String> warnings;
}
