package qg.po.midterm.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.repository.TaskRuntimeRepository;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.vo.SseTicketVO;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * SSE 服务。
 *
 * <p>负责 Ticket、连接、事件发送和心跳，不负责执行 Workflow。</p>
 */
@Service
@RequiredArgsConstructor
public class AnalysisEventServiceImpl implements AnalysisEventService {

    private static final int TICKET_EXPIRES_IN = 60;
    private static final long SSE_TIMEOUT = 0L;

    private final AnalysisTaskMapper taskMapper;
    private final TaskRuntimeRepository runtimeRepository;

    /**
     * 创建一次性 SSE Ticket。
     */
    @Override
    public SseTicketVO createTicket(String taskId) {
        AnalysisTask task = getTaskOrThrow(taskId);

        // TODO 校验当前登录用户是否拥有这个任务。


        String ticket = runtimeRepository.createTicket(
                "t_" + task.getId(),
                TICKET_EXPIRES_IN
        );

        String sseUrl = "/api/v1/analysis-tasks/"
                + taskId
                + "/events?ticket="
                + ticket;

        return new SseTicketVO(sseUrl, TICKET_EXPIRES_IN);
    }

    /**
     * 校验并消费 Ticket，然后建立 SSE 连接。
     */
    @Override
    public SseEmitter connect(String taskId, String ticket) {
        getTaskOrThrow(taskId);

        if (ticket == null || ticket.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "SSE Ticket 不能为空");
        }

        boolean valid = runtimeRepository.consumeTicket(taskId, ticket);
        if (!valid) {
            throw new BusinessException(
                    ErrorCode.UNAUTHORIZED,
                    "SSE Ticket 无效、已使用或已过期"
            );
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        runtimeRepository.addConnection(taskId, emitter);

        // 浏览器断开、超时或发送失败时清理连接。
        emitter.onCompletion(() -> runtimeRepository.removeConnection(taskId, emitter));
        emitter.onTimeout(() -> runtimeRepository.removeConnection(taskId, emitter));
        emitter.onError(error -> runtimeRepository.removeConnection(taskId, emitter));

        // 文档要求页面状态通过 GET /analysis-tasks/{taskId} 恢复，
        // 所以建立连接后无需发送 task_snapshot。
        sendToEmitter(
                taskId,
                emitter,
                "ping",
                Map.of("serverTime", OffsetDateTime.now())
        );

        return emitter;
    }

    @Override
    public void sendStepUpdate(String taskId, Map<String, Object> data) {
        sendEvent(taskId, "step_update", data);
    }

    @Override
    public void sendToolCall(String taskId, Map<String, Object> data) {
        sendEvent(taskId, "tool_call", data);
    }

    @Override
    public void sendResultReady(String taskId, Map<String, Object> data) {
        sendEvent(taskId, "result_ready", data);
    }

    @Override
    public void sendTaskFailed(String taskId, Map<String, Object> data) {
        sendEvent(taskId, "task_failed", data);
    }

    /**
     * 每 20 秒给所有在线连接发送 ping，防止代理超时。
     */
    @Scheduled(fixedRate = 20_000)
    public void sendPing() {
        runtimeRepository.getAllConnections().forEach((taskId, emitters) -> {
            for (SseEmitter emitter : List.copyOf(emitters)) {
                sendToEmitter(
                        taskId,
                        emitter,
                        "ping",
                        Map.of("serverTime", OffsetDateTime.now())
                );
            }
        });
    }

    /**
     * 向某个任务的全部在线页面发送事件。
     */
    private void sendEvent(
            String taskId,
            String eventName,
            Map<String, Object> data) {
        for (SseEmitter emitter : runtimeRepository.getConnections(taskId)) {
            sendToEmitter(taskId, emitter, eventName, data);
        }
    }

    /**
     * 真正执行 SSE 发送；发送失败就清理连接。
     */
    private void sendToEmitter(
            String taskId,
            SseEmitter emitter,
            String eventName,
            Map<String, Object> data) {
        try {
            emitter.send(
                    SseEmitter.event()
                            .id(runtimeRepository.nextEventId(taskId))
                            .name(eventName)
                            .data(data)
            );
        } catch (IOException exception) {
            runtimeRepository.removeConnection(taskId, emitter);
            emitter.complete();
        }
    }

    private AnalysisTask getTaskOrThrow(String taskId) {
        Long taskDbId = parseTaskId(taskId);
        AnalysisTask task = taskMapper.selectById(taskDbId);
        if (task == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "分析任务不存在");
        }
        return task;
    }

    private Long parseTaskId(String taskId) {
        if (taskId == null || !taskId.startsWith("t_")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "taskId 格式错误");
        }

        try {
            return Long.parseLong(taskId.substring(2));
        } catch (NumberFormatException exception) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "taskId 格式错误");
        }
    }
}
