package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RetryStepVO {

    private String taskId;
    private String stepId;
    private String status;
    private String message;
}
