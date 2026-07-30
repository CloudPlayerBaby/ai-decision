package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * 发起分析后的返回数据。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateTaskVO {

    private String taskId;
    private String decisionId;
    private String taskType;
    private String status;
    private OffsetDateTime startedAt;
}
