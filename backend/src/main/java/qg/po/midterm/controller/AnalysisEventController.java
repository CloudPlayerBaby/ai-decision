package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.AnalysisLogVO;
import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.CreateTaskVO;
import qg.po.midterm.vo.RetryStepVO;

import java.util.List;

/**
 * Agent 异步推演与任务接口
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnalysisEventController {

    private final AnalysisTaskService analysisTaskService;
    private final AnalysisEventService analysisEventService;

    /**
     * 发起整轮推演
     * X-Idempotency-Key 为必填请求头，用于幂等性防止重复提交
     */
    @PostMapping("/decisions/{decisionId}/analysis")
    public Result<CreateTaskVO> startAnalysis(
            @PathVariable String decisionId,
            @RequestHeader("X-Idempotency-Key") String idempotencyKey) {
        return Result.success(
                analysisTaskService.startFullAnalysis(decisionId, idempotencyKey)
        );
    }

    /**
     * 查询任务详情
     * 页面首次进入、刷新以及 SSE 重连前均调用此接口
     */
    @GetMapping("/analysis-tasks/{taskId}")
    public Result<AnalysisTaskVO> getTask(@PathVariable String taskId) {
        return Result.success(analysisTaskService.getTask(taskId));
    }

    /**
     * 查询指定事件之后的完整过程日志，用于 SSE 断线后的事件补偿
     */
    @GetMapping("/analysis-tasks/{taskId}/logs")
    public Result<List<AnalysisLogVO>> getTaskLogs(
            @PathVariable String taskId,
            @RequestParam(required = false) String afterEventId,
            @RequestParam(defaultValue = "100") int limit) {
        return Result.success(
                analysisTaskService.getTaskLogs(taskId, afterEventId, limit)
        );
    }

    /**
     * 连接分析任务 SSE
     * <p>
     * 重连时前端通过 Last-Event-ID 携带最后收到的事件 ID；
     * 服务层应先发送 task_snapshot，再补发遗漏事件，并每 15～30 秒发送 ping
     */
    @GetMapping(
            value = "/analysis-tasks/{taskId}/events",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter connectEvents(
            @PathVariable String taskId,
            @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
        return analysisEventService.connect(taskId, lastEventId);
    }

    /**
     * 重试失败步骤
     * 步骤状态和前置步骤校验由服务层统一完成
     */
    @PostMapping("/analysis-tasks/{taskId}/steps/{stepId}/retry")
    public Result<RetryStepVO> retryStep(
            @PathVariable String taskId,
            @PathVariable String stepId) {
        return Result.success(analysisTaskService.retryStep(taskId, stepId));
    }
}
