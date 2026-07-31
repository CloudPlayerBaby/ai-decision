package qg.po.midterm.workflow.event;

import org.springframework.context.ApplicationEvent;

/**
 * Workflow 节点执行事件。
 */
public class NodeExecutionEvent extends ApplicationEvent {

    private final String nodeName;
    private final String decisionId;
    private final String taskId;
    private final String status;
    private final String errorMessage;
    private final String outputData; // AI 节点生成的 JSON 数据
    private final Exception exception;

    /**
     * 节点正常开始时使用。
     */
    public NodeExecutionEvent(
            Object source,
            String nodeName,
            String decisionId,
            String taskId,
            String status) {
        this(source, nodeName, decisionId, taskId, status, null, null, null);
    }

    /**
     * 节点失败时使用，传入错误信息。
     */
    public NodeExecutionEvent(
            Object source,
            String nodeName,
            String decisionId,
            String taskId,
            String status,
            String errorMessage) {
        this(source, nodeName, decisionId, taskId, status, errorMessage, null, null);
    }

    /**
     * 节点失败时使用，传入异常对象。
     */
    public NodeExecutionEvent(
            Object source,
            String nodeName,
            String decisionId,
            String taskId,
            String status,
            Exception exception) {
        this(source, nodeName, decisionId, taskId, status, exception != null ? exception.getMessage() : null, null, exception);
    }

    /**
     * 节点成功时使用，传入执行结果 (outputData)。
     */
    public NodeExecutionEvent(
            Object source,
            String nodeName,
            String decisionId,
            String taskId,
            String status,
            String errorMessage,
            String outputData,
            Exception exception) {
        super(source);
        this.nodeName = nodeName;
        this.decisionId = decisionId;
        this.taskId = taskId;
        this.status = status;
        this.errorMessage = errorMessage;
        this.outputData = outputData;
        this.exception = exception;
    }

    public NodeExecutionEvent(
            Object source,
            String nodeName,
            String decisionId,
            String taskId,
            String status,
            String errorMessage,
            String outputData) {
        this(source, nodeName, decisionId, taskId, status, errorMessage, outputData, null);
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

    public String getErrorMessage() {
        return errorMessage;
    }

    public String getOutputData() {
        return outputData;
    }

    public Exception getException() {
        return exception;
    }
}
