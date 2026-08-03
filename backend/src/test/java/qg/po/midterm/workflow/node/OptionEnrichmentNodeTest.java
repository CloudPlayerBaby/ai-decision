package qg.po.midterm.workflow.node;

import org.junit.jupiter.api.Test;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OptionEnrichmentNodeTest {

    @Test
    void mergesOnlyTargetOptionAndPreservesUserIdentityFields() {
        Option existing = option("a", "已有方案", "已有描述");
        Option draft = option("c", "用户新增", "用户描述");
        Option enriched = completeOption("c", "模型改名", "模型描述");

        List<Option> merged = OptionEnrichmentNode.mergeEnrichedOptions(
                List.of(existing, draft), List.of(enriched), List.of("c"));

        assertSame(existing, merged.get(0));
        assertEquals("c", merged.get(1).getId());
        assertEquals("用户新增", merged.get(1).getName());
        assertEquals("用户描述", merged.get(1).getDescription());
        assertEquals(List.of("优点"), merged.get(1).getPros());
    }

    @Test
    void rejectsUnknownReturnedOptionId() {
        OptionEnrichmentNode.OptionEnrichmentResult result =
                new OptionEnrichmentNode.OptionEnrichmentResult(
                        "完成", "内容", List.of(completeOption("wrong", "错误", "描述")));

        List<String> errors = OptionEnrichmentNode.validateEnrichment(result, List.of("c"));

        assertTrue(errors.stream().anyMatch(error -> error.contains("ID") || error.contains("id")));
    }

    @Test
    void rejectsMissingScores() {
        Option incomplete = option("c", "新增方案", "描述");
        incomplete.setPros(List.of("优点"));
        incomplete.setCons(List.of("缺点"));
        incomplete.setRisks(List.of("风险"));

        List<String> errors = OptionEnrichmentNode.validateEnrichment(
                new OptionEnrichmentNode.OptionEnrichmentResult("完成", "内容", List.of(incomplete)),
                List.of("c"));

        assertTrue(errors.stream().anyMatch(error -> error.contains("scores")));
    }

    @Test
    void rejectsMissingOptionAnalysisLists() {
        Option incomplete = option("c", "新增方案", "描述");
        incomplete.setScores(Map.of(
                "cost", 3, "time", 3, "benefit", 4, "risk", 3, "feasibility", 4));

        List<String> errors = OptionEnrichmentNode.validateEnrichment(
                new OptionEnrichmentNode.OptionEnrichmentResult("完成", "内容", List.of(incomplete)),
                List.of("c"));

        assertTrue(errors.stream().anyMatch(error -> error.contains("pros")));
        assertTrue(errors.stream().anyMatch(error -> error.contains("cons")));
        assertTrue(errors.stream().anyMatch(error -> error.contains("risks")));
    }

    private Option option(String id, String name, String description) {
        Option option = new Option();
        option.setId(id);
        option.setName(name);
        option.setDescription(description);
        return option;
    }

    private Option completeOption(String id, String name, String description) {
        Option option = option(id, name, description);
        option.setPros(List.of("优点"));
        option.setCons(List.of("缺点"));
        option.setRisks(List.of("风险"));
        option.setScores(Map.of(
                "cost", 3, "time", 3, "benefit", 4, "risk", 3, "feasibility", 4));
        return option;
    }
}
