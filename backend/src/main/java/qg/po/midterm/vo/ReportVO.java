package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import qg.po.midterm.dto.result.ReportContent;

/**
 * 正式分析报告视图（API v2.0 11.1 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportVO {

    private String id;
    private String decisionId;
    private String analysisResultId;
    private String status;
    private ReportContent content;
    private String generatedAt;
}
