package qg.po.midterm.workflow.event;

import org.springframework.context.ApplicationEvent;

/**
 * 工作流执行失败事件，由 WorkflowExecutor 抛出。
 */
public class WorkflowFailedEvent extends ApplicationEvent {
    
    private final String taskId;
    private final String errorMessage;

    public WorkflowFailedEvent(Object source, String taskId, String errorMessage) {
        super(source);
        this.taskId = taskId;
        this.errorMessage = errorMessage;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getErrorMessage() {
        return errorMessage;
    }
}
