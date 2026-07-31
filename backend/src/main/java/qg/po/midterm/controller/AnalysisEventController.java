package qg.po.midterm.controller;

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
 * 发起分析和建立 SSE 连接。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnalysisEventController {

    private final AnalysisTaskService taskService;
    private final AnalysisEventService eventService;

    /**
     * 发起一次完整分析
     */
    @PostMapping("/decisions/{decisionId}/analysis")
    public Result<CreateTaskVO> startAnalysis(@PathVariable String decisionId) {
        return Result.success(taskService.startFullAnalysis(decisionId));
    }

    /**
     * 根据画布中发生变化的节点发起局部推演（按接口文档，这里是前端直接传入 IDs）
     */
    @PostMapping("/decisions/{decisionId}/partial-analysis")
    public Result<PartialTaskVO> startPartialAnalysis(
            @PathVariable String decisionId,
            @RequestBody PartialAnalysisRequest request) {
        return Result.success(
                taskService.startPartialAnalysis(decisionId, request)
        );
    }

    /**
     * 使用一次性 ticket 建立 SSE 连接
     * <p>
     * 前端必须先调用 POST /analysis-tasks/{taskId}/sse-ticket 获取 ticket
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
