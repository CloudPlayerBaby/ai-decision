package qg.po.midterm.dto.request;

import lombok.Data;

/**
 * 选择倾向方案请求（API v2.0 9.2 节）
 */
@Data
public class PreferredOptionRequest {

    /** 分析结果ID，格式 "ar_xxx" */
    private String analysisResultId;

    /** 方案ID，格式 "opt_xxx" */
    private String optionId;
}
