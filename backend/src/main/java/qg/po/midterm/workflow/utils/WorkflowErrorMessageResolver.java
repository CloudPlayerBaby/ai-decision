package qg.po.midterm.workflow.utils;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import qg.po.midterm.common.exception.AiValidationException;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class WorkflowErrorMessageResolver {

    private static final String WORKFLOW_FAILURE_MESSAGE = "推演执行失败，请稍后重试";

    public static String toClientMessage(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof AiValidationException
                    && current.getMessage() != null
                    && !current.getMessage().isBlank()) {
                return current.getMessage();
            }
            current = current.getCause();
        }
        return WORKFLOW_FAILURE_MESSAGE;
    }
}
