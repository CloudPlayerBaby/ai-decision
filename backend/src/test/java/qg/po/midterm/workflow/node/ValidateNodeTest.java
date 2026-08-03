package qg.po.midterm.workflow.node;

import org.junit.jupiter.api.Test;
import qg.po.midterm.common.exception.AiValidationException;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.ValidationResult;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ValidateNodeTest {

    private final ValidateNode validateNode = new ValidateNode();

    @Test
    void acceptsValidResultAndWritesValidationMetadata() throws Exception {
        DecisionState state = validState();
        state = withStateValue(state, "repairAttempted", true);

        Map<String, Object> update = validateNode.apply(state);

        ValidationResult validation = (ValidationResult) update.get("validation");
        assertTrue(validation.isSchemaValid());
        assertTrue(validation.isRepaired());
    }

    @Test
    void acceptsFourOptionsAfterManualAddition() throws Exception {
        DecisionState state = validState();
        List<Option> options = new ArrayList<>(state.getOptions());
        options.add(option("opt_c", "Option C"));
        options.add(option("opt_d", "Option D"));
        state = withStateValue(state, "options", options);

        Map<String, Object> update = validateNode.apply(state);

        ValidationResult validation = (ValidationResult) update.get("validation");
        assertTrue(validation.isSchemaValid());
        assertEquals("", update.get("errorMsg"));
    }

    @Test
    void rejectsRecommendationOutsideOptionsAfterRepair() {
        DecisionState state = validState();
        state.getRecommendation().setOptionId("opt_missing");
        DecisionState invalidState = withStateValue(state, "retryCount", 1);

        AiValidationException exception = assertThrows(AiValidationException.class,
                () -> validateNode.apply(invalidState));

        assertTrue(exception.getMissingFields().contains("recommendation.optionId"));
    }

    @Test
    void rejectsScoreOutsideOneToFive() {
        DecisionState state = validState();
        state.getOptions().get(0).getScores().put("cost", 9);
        DecisionState invalidState = withStateValue(state, "retryCount", 1);

        AiValidationException exception = assertThrows(AiValidationException.class,
                () -> validateNode.apply(invalidState));

        assertTrue(exception.getMissingFields().contains("options[0].scores.cost"));
    }

    private DecisionState validState() {
        Factor firstFactor = new Factor("time_cost", "时间", "时间因素", 0.5);
        Factor secondFactor = new Factor("benefit", "收益", "收益因素", 0.5);
        Option first = option("opt_a", "方案A");
        Option second = option("opt_b", "方案B");
        AnalysisResultDto.Recommendation recommendation =
                new AnalysisResultDto.Recommendation("opt_a", "综合评分更优");
        Map<String, Object> data = new HashMap<>();
        data.put("understanding", "需要在约束条件下选择方案");
        data.put("factors", List.of(firstFactor, secondFactor));
        data.put("options", List.of(first, second));
        data.put("recommendation", recommendation);
        data.put("nextActions", List.of("执行第一步"));
        return new DecisionState(data);
    }

    private Option option(String id, String name) {
        Option option = new Option();
        option.setId(id);
        option.setName(name);
        option.setDescription("description");
        option.setPros(List.of());
        option.setCons(List.of());
        option.setRisks(List.of());
        option.setScores(new HashMap<>(Map.of(
                "cost", 3,
                "time", 3,
                "benefit", 4,
                "risk", 3,
                "feasibility", 4
        )));
        return option;
    }

    private DecisionState withStateValue(DecisionState state, String key, Object value) {
        Map<String, Object> data = new HashMap<>(state.data());
        data.put(key, value);
        return new DecisionState(data);
    }
}
