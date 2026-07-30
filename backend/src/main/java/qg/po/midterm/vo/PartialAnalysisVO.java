package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 局部重推响应（API v2.0 10.3 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartialAnalysisVO {

    private String taskId;
    private String taskType;
    private String status;
    private List<String> affectedNodeIds;
}
