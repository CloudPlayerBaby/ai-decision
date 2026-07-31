package qg.po.midterm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 确认分析结果并生成报告请求（API v2.0 9.3 节）
 */
@Data
public class ConfirmDecisionRequest {

    /** 待确认的分析结果ID，格式 "ar_xxx" */
    @NotBlank(message = "analysisResultId 不能为空")
    @Pattern(regexp = "^ar_\\d+$", message = "analysisResultId 格式错误")
    private String analysisResultId;

    /** 用户选择的方案ID，格式 "opt_xxx" */
    @NotBlank(message = "selectedOptionId 不能为空")
    @Pattern(regexp = "^opt_[A-Za-z0-9_-]+$", message = "selectedOptionId 格式错误")
    private String selectedOptionId;
}
