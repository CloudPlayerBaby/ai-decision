package qg.po.midterm.workflow.node;

import org.junit.jupiter.api.Test;
import qg.po.midterm.workflow.state.Factor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FactorEnrichmentNodeTest {

    @Test
    void mergesOnlyTargetFactorAndPreservesUserIdentityFields() {
        Factor existing = factor("f_existing", "预算约束", "已有描述", 0.3);
        Factor draft = factor("f_new", "时间成本", "用户占位描述", 0.2);
        Factor enriched = factor("f_new", "模型改名", "时间越紧，越应优先短平快方案", 0.9);

        List<Factor> merged = FactorEnrichmentNode.mergeEnrichedFactors(
                List.of(existing, draft), List.of(enriched), List.of("f_new"));

        assertSame(existing, merged.get(0));
        assertEquals("f_new", merged.get(1).getId());
        assertEquals("时间成本", merged.get(1).getName());
        assertEquals(0.2, merged.get(1).getWeight(), 0.0001);
        assertEquals("时间越紧，越应优先短平快方案", merged.get(1).getDescription());
    }

    @Test
    void rejectsUnknownReturnedFactorId() {
        FactorEnrichmentNode.FactorEnrichmentResult result =
                new FactorEnrichmentNode.FactorEnrichmentResult(
                        "完成", "内容", List.of(factor("wrong", "错误", "描述", 0.5)));

        List<String> errors = FactorEnrichmentNode.validateEnrichment(result, List.of("f_new"));

        assertTrue(errors.stream().anyMatch(error -> error.contains("ID") || error.contains("id")));
    }

    @Test
    void rejectsMissingDescription() {
        Factor incomplete = factor("f_new", "时间成本", null, 0.2);

        List<String> errors = FactorEnrichmentNode.validateEnrichment(
                new FactorEnrichmentNode.FactorEnrichmentResult("完成", "内容", List.of(incomplete)),
                List.of("f_new"));

        assertTrue(errors.stream().anyMatch(error -> error.contains("description")));
    }

    private Factor factor(String id, String name, String description, double weight) {
        Factor factor = new Factor();
        factor.setId(id);
        factor.setName(name);
        factor.setDescription(description);
        factor.setWeight(weight);
        return factor;
    }
}
