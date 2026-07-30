package qg.po.midterm.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import qg.po.midterm.service.AnalysisEventService;

/**
 * 分析事件服务的默认实现。
 */
@Service
public class AnalysisEventServiceImpl implements AnalysisEventService {

    @Override
    public SseEmitter connect(String taskId, String lastEventId) {
        // TODO 发送 task_snapshot、补发遗漏事件，并每 15～30 秒发送 ping。
        return null;
    }
}
