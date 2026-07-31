package qg.po.midterm.vo;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 确认分析结果响应（API v2.0 9.3 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConfirmResultVO {
    private String decisionId;
    private String status;
    private String analysisResultId;
    private String reportId;
    private String reportStatus;
}
