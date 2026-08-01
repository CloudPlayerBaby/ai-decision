package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.service.ReportService;
import qg.po.midterm.vo.ReportSummaryVO;
import qg.po.midterm.vo.ReportVO;

import java.util.List;

/**
 * 报告接口：报告查询与重新生成（PRD 第 11 节）
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * 11.1 获取报告
     * <p>根据报告 ID 获取已生成的最终报告。
     */
    @GetMapping("/reports/{reportId}")
    public Result<ReportVO> getReport(@PathVariable String reportId) {
        ReportVO vo = reportService.getReport(reportId);
        return Result.success(vo);
    }

    /**
     * 11.1 获取决策最新报告
     * <p>根据决策 ID 获取最新已确认的报告。
     */
    @GetMapping("/decisions/{decisionId}/report")
    public Result<ReportVO> getReportByDecision(@PathVariable String decisionId) {
        ReportVO vo = reportService.getReportByDecision(decisionId);
        return Result.success(vo);
    }

    /**
     * 11.1 获取历史报告列表
     * <p>返回某决策的所有历史报告摘要。
     */
    @GetMapping("/decisions/{decisionId}/reports")
    public Result<List<ReportSummaryVO>> getReportHistory(@PathVariable String decisionId) {
        List<ReportSummaryVO> list = reportService.getReportHistory(decisionId);
        return Result.success(list);
    }

    /**
     * 11.2 重新生成报告
     * <p>基于已确认结果重新生成报告，不重新调用分析 Agent；创建新记录保留历史。
     */
    @PostMapping("/decisions/{decisionId}/regenerate-report")
    public Result<ReportVO> regenerateReport(@PathVariable String decisionId) {
        ReportVO vo = reportService.regenerateReport(decisionId);
        return Result.success(vo);
    }
}
