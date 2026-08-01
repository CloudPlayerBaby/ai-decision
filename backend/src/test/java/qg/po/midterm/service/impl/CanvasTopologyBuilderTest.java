package qg.po.midterm.service.impl;

import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class CanvasTopologyBuilderTest {

    @Test
    void connectsRootToFactorsAndEveryFactorToEveryOption() {
        List<Factor> factors = List.of(
                new Factor("f_1", "factor 1", "", 0.5),
                new Factor("f_2", "factor 2", "", 0.5)
        );
        Option first = option("opt_1");
        Option second = option("opt_2");

        List<Canvas.CanvasEdge> edges = CanvasTopologyBuilder.buildEdges(
                factors,
                List.of(first, second)
        );

        assertEquals(6, edges.size());
        assertEquals(2, edges.stream().filter(edge -> "HAS_FACTOR".equals(edge.getRelation())).count());
        assertEquals(4, edges.stream().filter(edge -> "AFFECTS".equals(edge.getRelation())).count());
        assertFalse(edges.stream().anyMatch(edge ->
                "root".equals(edge.getSource()) && edge.getTarget().startsWith("opt_")));
    }

    private Option option(String id) {
        Option option = new Option();
        option.setId(id);
        option.setName(id);
        return option;
    }
}
