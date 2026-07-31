package qg.po.midterm.vo;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class TaskErrorVO {

    private Integer code;
    private String message;
    private Boolean retryable;
    private String failedStepId;
    private List<String> missingFields;
    private Boolean repairAttempted;

    public TaskErrorVO(Integer code, String message, Boolean retryable, String failedStepId) {
        this(code, message, retryable, failedStepId, null, null);
    }

    public TaskErrorVO(Integer code, String message, Boolean retryable, String failedStepId,
                       List<String> missingFields, Boolean repairAttempted) {
        this.code = code;
        this.message = message;
        this.retryable = retryable;
        this.failedStepId = failedStepId;
        this.missingFields = missingFields;
        this.repairAttempted = repairAttempted;
    }
}
