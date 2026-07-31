package qg.po.midterm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
    @NotEmpty(message = "changedNodeIds 不能为空")
    private List<@NotBlank(message = "changedNodeIds 不能包含空值") String> changedNodeIds;
}
