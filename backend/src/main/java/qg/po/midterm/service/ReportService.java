package qg.po.midterm.service;

import qg.po.midterm.vo.ReportSummaryVO;
import qg.po.midterm.vo.ReportVO;

import java.util.List;

/**
 * 报告服务接口（API v2.0 第 11 节）
 */
public interface ReportService {

    /** 11.1 根据报告ID获取报告 */
    ReportVO getReport(String reportId);

    /** 11.1 根据决策ID获取最新报告 */
    ReportVO getReportByDecision(String decisionId);

    /** 11.1 获取决策的所有历史报告 */
    List<ReportSummaryVO> getReportHistory(String decisionId);

    /** 11.2 基于已确认结果重新生成报告（创建新记录，不覆盖历史） */
    ReportVO regenerateReport(String decisionId);
}
