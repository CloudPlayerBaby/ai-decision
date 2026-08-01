package qg.po.midterm.vo;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 历史报告摘要（API v2.0 11.1 历史列表）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ReportSummaryVO {

    private String id;
    private String decisionId;
    private String title;
    private String analysisResultId;
    private String status;
    private String generatedAt;
}
