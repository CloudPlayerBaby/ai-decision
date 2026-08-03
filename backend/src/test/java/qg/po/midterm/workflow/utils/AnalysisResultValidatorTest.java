package qg.po.midterm.workflow.utils;

import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AnalysisResultValidator 单元测试。
 *
 * <p>逐条覆盖 PRD 4.2/4.3 数据契约的校验规则（第 12 章强校验）。</p>
 */
class AnalysisResultValidatorTest {

    @Test
    void testValidDto_Passes() {
        assertTrue(AnalysisResultValidator.validate(validDto()).isEmpty());
    }

    @Test
    void testNullDto_Fails() {
        assertHasError(null, "result");
    }

    @Test
    void testBlankUnderstanding_Fails() {
        AnalysisResultDto dto = validDto();
        dto.setUnderstanding("  ");
        assertHasError(dto, "understanding");
    }

    @Test
    void testEmptyFactors_Fails() {
        AnalysisResultDto dto = validDto();
        dto.setFactors(List.of());
        assertHasError(dto, "factors");
    }

    @Test
    void testFactorMissingName_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getFactors().get(0).setName("");
        assertHasError(dto, "factors[0].name");
    }

    @Test
    void testFactorWeightOutOfRange_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getFactors().get(0).setWeight(1.5);
        assertHasError(dto, "factors[0].weight");
    }

    @Test
    void testOnlyOneOption_Fails() {
        AnalysisResultDto dto = validDto();
        dto.setOptions(List.of(dto.getOptions().get(0)));
        assertHasError(dto, "options");
    }

    @Test
    void testEmptyGeneratedOptions_FailBeforeRiskAnalysis() {
        List<String> errors = AnalysisResultValidator.validateOptions(List.of());
        assertTrue(errors.stream().anyMatch(error -> error.startsWith("options")));
    }

    @Test
    void testOptionMissingName_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getOptions().get(0).setName(null);
        assertHasError(dto, "options[0].name");
    }

    @Test
    void testDuplicateOptionId_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getOptions().get(1).setId(dto.getOptions().get(0).getId());
        assertHasError(dto, "options[1].id");
    }

    @Test
    void testMissingScoreDimension_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getOptions().get(0).getScores().remove("feasibility");
        assertHasError(dto, "options[0].scores.feasibility");
    }

    @Test
    void testScoreOutOfRange_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getOptions().get(0).getScores().put("cost", 8);
        assertHasError(dto, "options[0].scores.cost");
    }

    @Test
    void testRecommendationNotReferencingOption_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getRecommendation().setOptionId("opt_999");
        assertHasError(dto, "recommendation.optionId");
    }

    @Test
    void testBlankRecommendationReason_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getRecommendation().setReason(null);
        assertHasError(dto, "recommendation.reason");
    }

    @Test
    void testEmptyNextActions_Fails() {
        AnalysisResultDto dto = validDto();
        dto.setNextActions(List.of("  ", ""));
        assertHasError(dto, "nextActions");
    }

    @Test
    void testTooManyPros_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getOptions().get(0).setPros(
                List.of("1", "2", "3", "4", "5", "6", "7", "8", "9"));
        assertHasError(dto, "options[0].pros");
    }

    @Test
    void testProsItemTooLong_Fails() {
        AnalysisResultDto dto = validDto();
        dto.getOptions().get(0).setPros(List.of("x".repeat(201)));
        assertHasError(dto, "options[0].pros[0]");
    }

    private void assertHasError(AnalysisResultDto dto, String path) {
        List<String> errors = AnalysisResultValidator.validate(dto);
        assertTrue(errors.stream().anyMatch(error -> error.equals(path) || error.startsWith(path + " (")),
                "应包含错误: " + path + "，实际: " + errors);
    }

    private AnalysisResultDto validDto() {
        AnalysisResultDto dto = new AnalysisResultDto();
        dto.setUnderstanding("对问题和目标的理解");
        dto.setFactors(List.of(
                new Factor("f_1", "时间成本", "一周内可获得的掌握程度", 0.3)));
        dto.setOptions(List.of(
                new Option("opt_redis", "优先学习 Redis", "缓存场景与数据结构",
                        List.of("面试高频"), List.of("需理解缓存场景"),
                        List.of("缺少项目实践"), scores(4, 4, 5, 3, 4)),
                new Option("opt_docker", "优先学习 Docker", "工程化与部署能力",
                        List.of("贴近生产"), List.of("上手门槛高"),
                        List.of("本地环境受限"), scores(3, 3, 4, 4, 4))));
        dto.setRecommendation(new AnalysisResultDto.Recommendation("opt_redis", "面试高频，收益最直接"));
        dto.setNextActions(List.of("完成缓存基础", "做一个缓存穿透演示"));
        return dto;
    }

    private Map<String, Integer> scores(int cost, int time, int benefit, int risk, int feasibility) {
        return new HashMap<>(Map.of(
                "cost", cost,
                "time", time,
                "benefit", benefit,
                "risk", risk,
                "feasibility", feasibility));
    }
}
