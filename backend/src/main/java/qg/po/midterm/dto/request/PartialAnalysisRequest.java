package qg.po.midterm.dto.request;

import lombok.Data;

import java.util.List;

/**
 * 发起局部重推请求（API v2.0 10.3 节）
 */
@Data
public class PartialAnalysisRequest {

    /** 变更的节点ID列表 */
    private List<String> changedNodeIds;
}
