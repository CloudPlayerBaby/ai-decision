package qg.po.midterm.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import qg.po.midterm.vo.SseTicketVO;

import java.util.Map;

/**
 * SSE Ticket、连接和标准事件发送接口。
 */
public interface AnalysisEventService {

    SseTicketVO createTicket(String taskId);

    SseEmitter connect(String taskId, String ticket);

    void sendStepUpdate(String taskId, Map<String, Object> data);

    void sendToolCall(String taskId, Map<String, Object> data);

    void sendResultReady(String taskId, Map<String, Object> data);

    void sendTaskFailed(String taskId, Map<String, Object> data);
}
