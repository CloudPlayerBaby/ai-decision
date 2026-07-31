package qg.po.midterm.workflow.event;

import org.springframework.context.ApplicationEvent;

import java.util.Map;

/**
 * 工作流执行完成事件，由 WorkflowExecutor 抛出。
 */
public class WorkflowCompletedEvent extends ApplicationEvent {
    
    private final String taskId;
    private final String decisionId;
    private final Map<String, Object> finalStateData;

    public WorkflowCompletedEvent(Object source, String taskId, String decisionId, Map<String, Object> finalStateData) {
        super(source);
        this.taskId = taskId;
        this.decisionId = decisionId;
        this.finalStateData = finalStateData;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getDecisionId() {
        return decisionId;
    }

    public Map<String, Object> getFinalStateData() {
        return finalStateData;
    }
}
