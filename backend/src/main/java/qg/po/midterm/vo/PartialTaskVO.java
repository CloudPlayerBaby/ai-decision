package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 发起局部推演后的返回数据。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PartialTaskVO {

    private String taskId;
    private String taskType;
    private String status;
    private List<String> affectedNodeIds;
}
