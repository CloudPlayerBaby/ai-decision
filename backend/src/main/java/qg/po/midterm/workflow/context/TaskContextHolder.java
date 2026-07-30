package qg.po.midterm.workflow.context;

public class TaskContextHolder {
    private static final ThreadLocal<TaskContext> contextHolder = new ThreadLocal<>();

    public static void setContext(String taskId, String decisionId) {
        contextHolder.set(new TaskContext(taskId, decisionId));
    }

    public static TaskContext getContext() {
        return contextHolder.get();
    }

    public static void clear() {
        contextHolder.remove();
    }

    public record TaskContext(String taskId, String decisionId) {}
}
