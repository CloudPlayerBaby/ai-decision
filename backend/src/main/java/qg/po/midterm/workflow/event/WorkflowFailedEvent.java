package qg.po.midterm.workflow.event;

import org.springframework.context.ApplicationEvent;
import qg.po.midterm.workflow.utils.WorkflowErrorMessageResolver;

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
        return WorkflowErrorMessageResolver.toClientMessage(exception);
    }

    public Exception getException() {
        return exception;
    }
}
