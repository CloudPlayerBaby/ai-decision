package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskErrorVO {

    private Integer code;
    private String message;
    private Boolean retryable;
    private String failedStepId;
}
