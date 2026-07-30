package qg.po.midterm.workflow.event;

import org.springframework.context.ApplicationEvent;

public class NodeExecutionEvent extends ApplicationEvent {
    private final String nodeName;
    private final String decisionId;
    private final String taskId;
    private final String status; // "STARTED", "FINISHED", "FAILED"

    public NodeExecutionEvent(Object source, String nodeName, String decisionId, String taskId, String status) {
        super(source);
        this.nodeName = nodeName;
        this.decisionId = decisionId;
        this.taskId = taskId;
        this.status = status;
    }

    public String getNodeName() {
        return nodeName;
    }

    public String getDecisionId() {
        return decisionId;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getStatus() {
        return status;
    }
    public String getErrorMessage() { return errorMessage; }
}
