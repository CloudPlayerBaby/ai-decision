package qg.po.midterm.service.impl;

import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.ArrayList;
import java.util.List;

/** 统一生成自动画布的业务拓扑。 */
final class CanvasTopologyBuilder {

    private CanvasTopologyBuilder() {
    }

    static List<Canvas.CanvasEdge> buildEdges(List<Factor> factors, List<Option> options) {
        List<Factor> safeFactors = factors != null ? factors : List.of();
        List<Option> safeOptions = options != null ? options : List.of();
        List<Canvas.CanvasEdge> edges = new ArrayList<>();

        for (Factor factor : safeFactors) {
            if (factor == null || factor.getId() == null) continue;
            edges.add(edge(
                    "e_factor_" + factor.getId(),
                    "root",
                    factor.getId(),
                    "HAS_FACTOR"
            ));

            for (Option option : safeOptions) {
                if (option == null || option.getId() == null) continue;
                edges.add(edge(
                        "e_affects_" + factor.getId() + "_" + option.getId(),
                        factor.getId(),
                        option.getId(),
                        "AFFECTS"
                ));
            }
        }

        return edges;
    }

    private static Canvas.CanvasEdge edge(String id, String source, String target, String relation) {
        return new Canvas.CanvasEdge(id, source, target, relation);
    }
}
