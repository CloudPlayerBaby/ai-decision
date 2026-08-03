package qg.po.midterm.service.impl;

import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.workflow.state.Option;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PartialAnalysisPlannerTest {

    private final PartialAnalysisPlanner planner = new PartialAnalysisPlanner();

    @Test
    void recognizesTemporaryFactorByCanvasTypeAndIncludesOptions() {
        Canvas canvas = new Canvas(List.of(
                node("root", "decision"),
                node("tmp_1", "factor"),
                node("choice_a", "option"),
                node("choice_b", "option")
        ), List.of());

        PartialAnalysisPlanner.Plan plan = planner.plan(canvas, new AnalysisResultDto(), List.of("tmp_1"));

        assertEquals("REEVALUATE_OPTIONS", plan.startNode());
        assertEquals(List.of("tmp_1"), plan.affectedNodeIds());
    }

    @Test
    void identifiesDeletedOptionFromCurrentResult() {
        AnalysisResultDto result = new AnalysisResultDto();
        Option option = new Option();
        option.setId("legacy_choice");
        result.setOptions(List.of(option));

        PartialAnalysisPlanner.Plan plan = planner.plan(new Canvas(List.of(), List.of()),
                result, List.of("legacy_choice"));

        assertEquals("COMPARE_OPTIONS", plan.startNode());
    }

    @Test
    void startsComparisonWhenOnlyExistingOptionChanged() {
        AnalysisResultDto result = new AnalysisResultDto();
        Option existing = new Option();
        existing.setId("option_1");
        result.setOptions(List.of(existing));
        Canvas canvas = new Canvas(List.of(
                node("root", "decision"),
                node("factor_1", "factor"),
                node("option_1", "option")
        ), List.of());

        PartialAnalysisPlanner.Plan plan = planner.plan(
                canvas,
                result,
                List.of("option_1")
        );

        assertEquals("COMPARE_OPTIONS", plan.startNode());
        assertTrue(plan.optionIdsToEnrich().isEmpty());
    }

    @Test
    void enrichesOptionThatExistsOnlyInLatestCanvas() {
        AnalysisResultDto result = new AnalysisResultDto();
        Option existing = new Option();
        existing.setId("option_1");
        result.setOptions(List.of(existing));

        Canvas canvas = new Canvas(List.of(
                node("root", "decision"),
                node("option_1", "option"),
                node("option_new", "option")
        ), List.of());

        PartialAnalysisPlanner.Plan plan = planner.plan(canvas, result, List.of("option_new"));

        assertEquals("ENRICH_OPTIONS", plan.startNode());
        assertEquals(List.of("option_new"), plan.optionIdsToEnrich());
    }

    @Test
    void factorChangeTakesPriorityOverNewOption() {
        AnalysisResultDto result = new AnalysisResultDto();
        Canvas canvas = new Canvas(List.of(
                node("factor_1", "factor"),
                node("option_new", "option")
        ), List.of());

        PartialAnalysisPlanner.Plan plan = planner.plan(
                canvas, result, List.of("factor_1", "option_new"));

        assertEquals("REEVALUATE_OPTIONS", plan.startNode());
        assertTrue(plan.optionIdsToEnrich().isEmpty());
    }

    private Canvas.CanvasNode node(String id, String type) {
        return new Canvas.CanvasNode(id, type, id, new Canvas.Position(0, 0), null);
    }
}
