package qg.po.midterm.service.impl;

import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CanvasMergeServiceTest {

    private final CanvasMergeService service = new CanvasMergeService();

    @Test
    void keepsPositionsButReplacesBusinessDataAndRemovesStaleNodes() {
        Canvas existing = new Canvas(List.of(
                new Canvas.CanvasNode("root", "decision", "old", new Canvas.Position(1, 2), Map.of(), null),
                new Canvas.CanvasNode("factor_custom", "factor", "old factor", new Canvas.Position(3, 4), Map.of(), null),
                new Canvas.CanvasNode("stale", "option", "stale", new Canvas.Position(5, 6), Map.of(), null)
        ), List.of());
        Factor factor = new Factor("factor_custom", "new factor", "description", 0.7);
        Option option = new Option();
        option.setId("new_option");
        option.setName("new option");
        option.setDescription("display only");
        option.setPros(List.of("pro"));
        option.setCons(List.of("con"));
        option.setRisks(List.of("risk"));
        option.setScores(Map.of("cost", 4));
        AnalysisResultDto result = new AnalysisResultDto();
        result.setFactors(List.of(factor));
        result.setOptions(List.of(option));

        Canvas merged = service.merge(existing, result, "decision");

        Canvas.CanvasNode mergedFactor = merged.getNodes().stream()
                .filter(node -> "factor_custom".equals(node.getId())).findFirst().orElseThrow();
        assertEquals(3, mergedFactor.getPosition().getX());
        assertEquals("new factor", mergedFactor.getLabel());
        assertEquals(Map.of("weight", 0.7), mergedFactor.getData());
        Canvas.CanvasNode mergedOption = merged.getNodes().stream()
                .filter(node -> "new_option".equals(node.getId())).findFirst().orElseThrow();
        assertEquals(Map.of("scores", Map.of("cost", 4)), mergedOption.getData());
        assertFalse(merged.getNodes().stream().anyMatch(node -> "stale".equals(node.getId())));
        assertTrue(merged.getEdges().stream().anyMatch(edge ->
                "root".equals(edge.getSource())
                        && "factor_custom".equals(edge.getTarget())
                        && "HAS_FACTOR".equals(edge.getRelation())));
        assertTrue(merged.getEdges().stream().anyMatch(edge ->
                "factor_custom".equals(edge.getSource())
                        && "new_option".equals(edge.getTarget())
                        && "AFFECTS".equals(edge.getRelation())));
        assertFalse(merged.getEdges().stream().anyMatch(edge ->
                "root".equals(edge.getSource()) && "new_option".equals(edge.getTarget())));
    }

    @Test
    void retainsExistingAndNewlyEnrichedOptionsAfterPartialAnalysis() {
        Canvas existing = new Canvas(List.of(
                new Canvas.CanvasNode("root", "decision", "decision", new Canvas.Position(0, 0), Map.of(), null),
                new Canvas.CanvasNode("a", "option", "A", new Canvas.Position(1, 1), Map.of(), null),
                new Canvas.CanvasNode("b", "option", "B", new Canvas.Position(2, 2), Map.of(), null),
                new Canvas.CanvasNode("c", "option", "C", new Canvas.Position(3, 3), Map.of(), null)
        ), List.of());
        AnalysisResultDto result = new AnalysisResultDto();
        result.setFactors(List.of());
        result.setOptions(List.of(
                completeOption("a", "A", 3),
                completeOption("b", "B", 4),
                completeOption("c", "C", 5)
        ));

        Canvas merged = service.merge(existing, result, "decision");

        assertTrue(merged.getNodes().stream().anyMatch(node -> "a".equals(node.getId())));
        assertTrue(merged.getNodes().stream().anyMatch(node -> "b".equals(node.getId())));
        Canvas.CanvasNode newOption = merged.getNodes().stream()
                .filter(node -> "c".equals(node.getId())).findFirst().orElseThrow();
        assertEquals(3, newOption.getPosition().getX());
        assertEquals(5, ((Map<?, ?>) newOption.getData().get("scores")).get("benefit"));
    }

    private Option completeOption(String id, String name, int benefit) {
        Option option = new Option();
        option.setId(id);
        option.setName(name);
        option.setDescription(name + " description");
        option.setPros(List.of("pro"));
        option.setCons(List.of("con"));
        option.setRisks(List.of("risk"));
        option.setScores(Map.of(
                "cost", 3, "time", 3, "benefit", benefit, "risk", 3, "feasibility", 4));
        return option;
    }
}
