package qg.po.midterm.workflow.event;

import org.springframework.context.ApplicationEvent;

/**
 * 工作流执行失败事件，由 WorkflowExecutor 抛出。
 */
public class WorkflowFailedEvent extends ApplicationEvent {
    
    private final String taskId;
    private final Exception exception;

    public WorkflowFailedEvent(Object source, String taskId, Exception exception) {
        super(source);
        this.taskId = taskId;
        this.exception = exception;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getErrorMessage() {
        if (exception == null || exception.getMessage() == null || exception.getMessage().isBlank()) {
            return exception == null ? "Workflow execution failed" : exception.getClass().getSimpleName();
        }
        return exception.getMessage();
    }

    public Exception getException() {
        return exception;
    }
}
