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
                new Canvas.CanvasNode("root", "decision", "old", new Canvas.Position(1, 2), Map.of()),
                new Canvas.CanvasNode("factor_custom", "factor", "old factor", new Canvas.Position(3, 4), Map.of()),
                new Canvas.CanvasNode("stale", "option", "stale", new Canvas.Position(5, 6), Map.of())
        ), List.of());
        Factor factor = new Factor("factor_custom", "new factor", "description", 0.7);
        Option option = new Option();
        option.setId("new_option");
        option.setName("new option");
        option.setScores(Map.of("cost", 4));
        AnalysisResultDto result = new AnalysisResultDto();
        result.setFactors(List.of(factor));
        result.setOptions(List.of(option));

        Canvas merged = service.merge(existing, result, "decision");

        Canvas.CanvasNode mergedFactor = merged.getNodes().stream()
                .filter(node -> "factor_custom".equals(node.getId())).findFirst().orElseThrow();
        assertEquals(3, mergedFactor.getPosition().getX());
        assertEquals("new factor", mergedFactor.getLabel());
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
}
