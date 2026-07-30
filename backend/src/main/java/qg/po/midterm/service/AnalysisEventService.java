package qg.po.midterm.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 负责分析事件的发布、订阅、心跳和断线恢复。
 *
 * <p>标准事件包括 task_snapshot、step_update、display_message、
 * tool_call、result_ready、task_failed 和 ping。</p>
 */
public interface AnalysisEventService {

    /**
     * 建立 SSE 连接。
     *
     * @param taskId      分析任务 ID
     * @param lastEventId 前端最后收到的事件 ID，首次连接时为 null
     * @return SSE 事件发送器
     */
    SseEmitter connect(String taskId, String lastEventId);
}
