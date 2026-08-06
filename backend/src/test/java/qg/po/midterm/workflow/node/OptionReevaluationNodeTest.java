package qg.po.midterm.workflow.node;

import org.junit.jupiter.api.Test;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OptionReevaluationNodeTest {

    @Test
    void mergesUpdatedContentAndScores() {
        Option option = new Option();
        option.setId("opt_1");
        option.setName("旧名称");
        option.setDescription("旧描述");
        option.setPros(List.of("旧优点"));
        option.setCons(List.of("旧缺点"));
        option.setRisks(List.of("旧风险"));
        option.setRelativeFactor("f_1");
        option.setScores(Map.of("cost", 1));

        OptionReevaluationNode.OptionUpdate update = new OptionReevaluationNode.OptionUpdate(
                "opt_1",
                "新名称",
                "新描述",
                List.of("新优点"),
                List.of("新缺点"),
                List.of("新风险"),
                "f_2",
                Map.of("cost", 5, "time", 4, "benefit", 3, "risk", 2, "feasibility", 1));

        List<Option> merged = OptionReevaluationNode.merge(List.of(option), List.of(update));

        // 方案名是身份字段，重评分保持原值，不随模型输出改变
        assertEquals("旧名称", merged.getFirst().getName());
        assertEquals("新描述", merged.getFirst().getDescription());
        assertEquals(List.of("新优点"), merged.getFirst().getPros());
        assertEquals(List.of("新缺点"), merged.getFirst().getCons());
        assertEquals(List.of("新风险"), merged.getFirst().getRisks());
        assertEquals("f_2", merged.getFirst().getRelativeFactor());
        assertEquals(update.scores(), merged.getFirst().getScores());
    }

    @Test
    void rejectsUpdatesWithMissingOrUnexpectedIds() {
        Option option = new Option();
        option.setId("opt_1");
        List<String> errors = OptionReevaluationNode.validate(
                new OptionReevaluationNode.OptionReevaluationResult("", "", List.of(
                        new OptionReevaluationNode.OptionUpdate("opt_2", "名称", "描述",
                                List.of("优点"), List.of("缺点"), List.of("风险"), "", Map.of()))),
                List.of(option),
                List.of());

        assertTrue(errors.stream().anyMatch(error -> error.contains("完全一致")));
    }
}
