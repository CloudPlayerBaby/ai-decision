package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.AnalysisLogVO;
import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.RetryStepVO;

import java.util.List;

/**
 * 分析任务查询、日志恢复和步骤重试接口。
 */
@RestController
@RequestMapping("/api/v1/analysis-tasks")
@RequiredArgsConstructor
public class AnalysisTaskController {

    private final AnalysisTaskService analysisTaskService;

    @GetMapping("/{taskId}")
    public Result<AnalysisTaskVO> getTask(@PathVariable String taskId) {
        return Result.success(analysisTaskService.getTask(taskId));
    }

    @GetMapping("/{taskId}/logs")
    public Result<List<AnalysisLogVO>> getTaskLogs(
            @PathVariable String taskId,
            @RequestParam(required = false) String afterEventId,
            @RequestParam(defaultValue = "100") int limit) {
        return Result.success(
                analysisTaskService.getTaskLogs(taskId, afterEventId, limit)
        );
    }

    @PostMapping("/{taskId}/steps/{stepId}/retry")
    public Result<RetryStepVO> retryStep(
            @PathVariable String taskId,
            @PathVariable String stepId) {
        return Result.success(analysisTaskService.retryStep(taskId, stepId));
    }
}
