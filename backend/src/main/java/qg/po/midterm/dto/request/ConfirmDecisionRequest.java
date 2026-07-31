package qg.po.midterm.dto.request;

import lombok.Data;

/**
 * 确认分析结果并生成报告请求（API v2.0 9.3 节）
 */
@Data
public class ConfirmDecisionRequest {

    /** 待确认的分析结果ID，格式 "ar_xxx" */
    private String analysisResultId;

    /** 用户选择的方案ID，格式 "opt_xxx" */
    private String selectedOptionId;
}
