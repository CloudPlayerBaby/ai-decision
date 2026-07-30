package qg.po.midterm.workflow.listener;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.event.NodeExecutionEvent;

/**
 * 监听工作流节点变化并转换为外部进度事件。
 */
@Component
public class NodeExecutionEventListener {

    @EventListener
    public void handleNodeExecutionEvent(NodeExecutionEvent event) {

        switch (event.getStatus()) {
            case "STARTED" -> handleStarted(event);
            case "FINISHED" -> handleFinished(event);
            case "FAILED" -> handleFailed(event);
            default -> System.out.println("未知状态：" + event.getStatus());
        }
    }

    private void handleStarted(NodeExecutionEvent event) {
        System.out.println(event.getNodeName() + " 节点开始执行");
    }

    private void handleFinished(NodeExecutionEvent event) {
        System.out.println(event.getNodeName() + " 节点执行完成");
    }

    private void handleFailed(NodeExecutionEvent event) {
        System.out.println(event.getNodeName() + " 节点执行失败");
    }
}
