package qg.po.midterm.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.dto.request.PartialAnalysisRequest;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.CreateTaskVO;
import qg.po.midterm.vo.PartialTaskVO;

/**
 * 推演与 SSE 接口：发起完整推演、局部重推与 SSE 连接（PRD 第 7、8、10 节）
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnalysisEventController {

    private final AnalysisTaskService taskService;
    private final AnalysisEventService eventService;

    /**
     * 7.1 发起完整推演
     * <p>若当前已有运行任务，返回 40901。
     */
    @PostMapping("/decisions/{decisionId}/analysis")
    public Result<CreateTaskVO> startAnalysis(@PathVariable String decisionId) {
        return Result.success(taskService.startFullAnalysis(decisionId));
    }

    /**
     * 10.3 发起局部重推
     * <p>根据 changedNodeIds 确定受影响子树，生成新的待确认草案。
     */
    @PostMapping("/decisions/{decisionId}/partial-analysis")
    public Result<PartialTaskVO> startPartialAnalysis(
            @PathVariable String decisionId,
            @Valid @RequestBody PartialAnalysisRequest request) {
        return Result.success(
                taskService.startPartialAnalysis(decisionId, request)
        );
    }

    /**
     * 8.2 建立 SSE 连接
     * <p>使用一次性 Ticket 建立 EventSource 连接；前端须先调用 POST /analysis-tasks/{taskId}/sse-ticket 获取 Ticket。
     */
    @GetMapping(
            value = "/analysis-tasks/{taskId}/events",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter connect(
            @PathVariable String taskId,
            @RequestParam String ticket) {
        return eventService.connect(taskId, ticket);
    }
}
