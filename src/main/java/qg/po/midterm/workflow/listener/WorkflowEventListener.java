package qg.po.midterm.workflow.listener;

public interface WorkflowEventListener {

    void onNodeStart(Long taskId, String nodeName);

    void onNodeComplete(Long taskId, String nodeName);

    void onNodeError(Long taskId, String nodeName, Exception e);

    void onWorkflowComplete(Long taskId);
}
