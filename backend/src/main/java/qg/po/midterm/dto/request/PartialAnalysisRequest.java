package qg.po.midterm.dto.request;

import lombok.Data;

import java.util.List;

/**
 * 发起局部推演的请求参数。
 */
@Data
public class PartialAnalysisRequest {

    /**
     * 保存画布接口计算出的变更节点 ID。
     */
    private List<String> changedNodeIds;
}
