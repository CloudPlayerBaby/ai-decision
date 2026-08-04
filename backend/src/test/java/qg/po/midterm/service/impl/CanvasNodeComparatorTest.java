package qg.po.midterm.service.impl;

import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.Canvas;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CanvasNodeComparatorTest {

    @Test
    void ignoresDisplayFieldsAndPositionForOption() {
        Canvas.CanvasNode oldNode = optionNode(Map.of(
                "scores", scores(3),
                "description", "AI 描述",
                "pros", java.util.List.of("优势")
        ), new Canvas.Position(10, 20));
        Canvas.CanvasNode newNode = optionNode(Map.of(
                "scores", scores(3)
        ), new Canvas.Position(300, 400));

        assertTrue(CanvasNodeComparator.businessEquals(oldNode, newNode));
    }

    @Test
    void detectsOptionScoreChange() {
        Canvas.CanvasNode oldNode = optionNode(Map.of("scores", scores(3)), new Canvas.Position(0, 0));
        Canvas.CanvasNode newNode = optionNode(Map.of("scores", scores(5)), new Canvas.Position(0, 0));

        assertFalse(CanvasNodeComparator.businessEquals(oldNode, newNode));
    }

    @Test
    void ignoresFactorDescriptionButDetectsWeightChange() {
        Canvas.CanvasNode oldNode = new Canvas.CanvasNode(
                "factor_1", "factor", "时间", new Canvas.Position(0, 0),
                Map.of("weight", 0.3, "description", "AI 描述"), null
        );
        Canvas.CanvasNode sameWeight = new Canvas.CanvasNode(
                "factor_1", "factor", "时间", new Canvas.Position(9, 9),
                Map.of("weight", 0.3), null
        );
        Canvas.CanvasNode changedWeight = new Canvas.CanvasNode(
                "factor_1", "factor", "时间", new Canvas.Position(9, 9),
                Map.of("weight", 0.4), null
        );

        assertTrue(CanvasNodeComparator.businessEquals(oldNode, sameWeight));
        assertFalse(CanvasNodeComparator.businessEquals(oldNode, changedWeight));
    }

    private Canvas.CanvasNode optionNode(Map<String, Object> data, Canvas.Position position) {
        return new Canvas.CanvasNode("option_1", "option", "方案一", position, data, null);
    }

    private Map<String, Integer> scores(int benefit) {
        Map<String, Integer> scores = new LinkedHashMap<>();
        scores.put("cost", 3);
        scores.put("time", 3);
        scores.put("benefit", benefit);
        scores.put("risk", 3);
        scores.put("feasibility", 3);
        return scores;
    }
}
