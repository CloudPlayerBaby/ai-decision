package qg.po.midterm.workflow.node;

import org.junit.jupiter.api.Test;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OptionReevaluationNodeTest {

    @Test
    void mergesOnlyScoresAndPreservesOptionContent() {
        Option option = new Option();
        option.setId("opt_1");
        option.setName("用户方案");
        option.setDescription("用户描述");
        option.setPros(List.of("优点"));
        option.setScores(Map.of("cost", 1));
        Map<String, Integer> scores = Map.of("cost", 5, "time", 4, "benefit", 3, "risk", 2, "feasibility", 1);

        List<Option> merged = OptionReevaluationNode.mergeScores(List.of(option),
                List.of(new OptionReevaluationNode.ScoreUpdate("opt_1", scores)));

        assertEquals("用户方案", merged.getFirst().getName());
        assertEquals("用户描述", merged.getFirst().getDescription());
        assertEquals(List.of("优点"), merged.getFirst().getPros());
        assertEquals(scores, merged.getFirst().getScores());
    }

    @Test
    void rejectsUpdatesWithMissingOrUnexpectedIds() {
        Option option = new Option();
        option.setId("opt_1");
        List<String> errors = OptionReevaluationNode.validate(
                new OptionReevaluationNode.OptionReevaluationResult("", "", List.of(
                        new OptionReevaluationNode.ScoreUpdate("opt_2", Map.of()))), List.of(option));

        assertTrue(errors.stream().anyMatch(error -> error.contains("完全一致")));
    }
}
