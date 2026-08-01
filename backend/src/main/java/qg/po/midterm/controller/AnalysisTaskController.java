package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.RetryStepVO;
import qg.po.midterm.vo.SseTicketVO;

/**
 * 推演任务接口：任务查询、失败步骤重试与 SSE Ticket（PRD 第 7、8 节）
 */
@RestController
@RequestMapping("/api/v1/analysis-tasks")
@RequiredArgsConstructor
public class AnalysisTaskController {

    private final AnalysisTaskService taskService;
    private final AnalysisEventService eventService;

    /**
     * 7.2 查询任务状态与步骤
     * <p>页面首次进入、刷新、SSE 断线重连前调用，返回持久化任务与完整步骤列表。
     */
    @GetMapping("/{taskId}")
    public Result<AnalysisTaskVO> getTask(@PathVariable String taskId) {
        return Result.success(taskService.getTask(taskId));
    }

    /**
     * 7.3 重试失败步骤
     * <p>仅当该步骤为 FAILED 且前置步骤成功时允许；已成功步骤不得重跑。
     */
    @PostMapping("/{taskId}/steps/{stepId}/retry")
    public Result<RetryStepVO> retryStep(
            @PathVariable String taskId,
            @PathVariable String stepId) {
        return Result.success(taskService.retryStep(taskId, stepId));
    }

    /**
     * 8.1 获取 SSE Ticket
     * <p>Ticket 仅限当前用户、当前任务、一次连接使用，有效期 60 秒。
     */
    @PostMapping("/{taskId}/sse-ticket")
    public Result<SseTicketVO> createSseTicket(@PathVariable String taskId) {
        return Result.success(eventService.createTicket(taskId));
    }
}
