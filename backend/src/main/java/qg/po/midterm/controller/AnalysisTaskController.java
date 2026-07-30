package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.RetryStepVO;
import qg.po.midterm.vo.SseTicketVO;

/**
 * 查询任务、重试步骤和申请 SSE Ticket。
 */
@RestController
@RequestMapping("/api/v1/analysis-tasks")
@RequiredArgsConstructor
public class AnalysisTaskController {

    private final AnalysisTaskService taskService;
    private final AnalysisEventService eventService;

    /**
     * 查询任务的持久化状态和完整步骤
     */
    @GetMapping("/{taskId}")
    public Result<AnalysisTaskVO> getTask(@PathVariable String taskId) {
        return Result.success(taskService.getTask(taskId));
    }

    /**
     * 重试一个失败步骤
     */
    @PostMapping("/{taskId}/steps/{stepId}/retry")
    public Result<RetryStepVO> retryStep(
            @PathVariable String taskId,
            @PathVariable String stepId) {
        return Result.success(taskService.retryStep(taskId, stepId));
    }

    /**
     * 获取 60 秒有效、只能使用一次的 SSE Ticket
     */
    @PostMapping("/{taskId}/sse-ticket")
    public Result<SseTicketVO> createSseTicket(@PathVariable String taskId) {
        return Result.success(eventService.createTicket(taskId));
    }
}
