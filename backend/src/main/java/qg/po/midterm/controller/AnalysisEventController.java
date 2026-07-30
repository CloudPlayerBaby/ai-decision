package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.CreateTaskVO;

/**
 * 分析任务发起与 SSE 事件订阅接口。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnalysisEventController {

    private final AnalysisTaskService analysisTaskService;
    private final AnalysisEventService analysisEventService;

    @PostMapping("/decisions/{decisionId}/analysis")
    public Result<CreateTaskVO> startAnalysis(
            @PathVariable String decisionId,
            @RequestHeader("X-Idempotency-Key") String idempotencyKey) {
        return Result.success(
                analysisTaskService.startFullAnalysis(decisionId, idempotencyKey)
        );
    }

    /**
     * 重连时通过 Last-Event-ID 携带最后收到的事件 ID。
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
}
