package qg.po.midterm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 选择倾向方案请求（API v2.0 9.2 节）
 */
@Data
public class PreferredOptionRequest {

    /** 分析结果ID，格式 "ar_xxx" */
    @NotBlank(message = "analysisResultId 不能为空")
    @Pattern(regexp = "^ar_\\d+$", message = "analysisResultId 格式错误")
    private String analysisResultId;

    /** 方案ID，格式 "opt_xxx" */
    @NotBlank(message = "optionId 不能为空")
    @Pattern(regexp = "^opt_[A-Za-z0-9_-]+$", message = "optionId 格式错误")
    private String optionId;
}
