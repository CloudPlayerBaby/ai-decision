package qg.po.midterm.vo;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.ValidationResult;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;

/**
 * 分析结果视图（API v2.0 9.1 节）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AnalysisResultVO {

    private String id;
    private String status;
    private String understanding;
    private List<Factor> factors;
    private List<Option> options;
    private AnalysisResultDto.Recommendation recommendation;
    private List<String> nextActions;
    private ValidationResult validation;
    private String createdAt;

    /**
     * 从实体 + 解析后的 DTO 构建 VO
     */
    public static AnalysisResultVO from(String id, String status, AnalysisResultDto dto, String createdAt) {
        return AnalysisResultVO.builder()
                .id(id)
                .status(status)
                .understanding(dto.getUnderstanding())
                .factors(dto.getFactors())
                .options(dto.getOptions())
                .recommendation(dto.getRecommendation())
                .nextActions(dto.getNextActions())
                .validation(dto.getValidation())
                .createdAt(createdAt)
                .build();
    }
}
