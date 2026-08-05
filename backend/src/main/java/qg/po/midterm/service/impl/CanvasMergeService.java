package qg.po.midterm.service.impl;

import org.springframework.stereotype.Component;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Merges fresh analysis data with user-maintained canvas positions. */
@Component
public class CanvasMergeService {

    public Canvas merge(Canvas existing, AnalysisResultDto result, String decisionTitle) {
        Map<String, Canvas.CanvasNode> oldNodes = indexNodes(existing);
        List<Canvas.CanvasNode> nodes = new ArrayList<>();
        List<Canvas.CanvasEdge> edges = new ArrayList<>();

        nodes.add(node("root", "decision", decisionTitle,
                position(oldNodes, "root", CanvasLayoutPlanner.rootPosition()), Collections.emptyMap()));

        List<Factor> factors = result != null && result.getFactors() != null
                ? result.getFactors() : List.of();
        for (int index = 0; index < factors.size(); index++) {
            Factor factor = factors.get(index);
            if (factor == null || factor.getId() == null) continue;
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("weight", factor.getWeight());
            nodes.add(node(factor.getId(), "factor", factor.getName(),
                    position(oldNodes, factor.getId(), new Canvas.Position(
                            CanvasLayoutPlanner.columnX("factor"),
                            CanvasLayoutPlanner.distributeY(index, factors.size()))), data));
        }

        List<Option> options = result != null && result.getOptions() != null
                ? result.getOptions() : List.of();
        for (int index = 0; index < options.size(); index++) {
            Option option = options.get(index);
            if (option == null || option.getId() == null) continue;
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("scores", option.getScores());
            Canvas.CanvasNode optionNode = node(option.getId(), "option", option.getName(),
                    position(oldNodes, option.getId(), new Canvas.Position(
                            CanvasLayoutPlanner.columnX("option"),
                            CanvasLayoutPlanner.distributeY(index, options.size()))), data);
            optionNode.setRelativeFactor(option.getRelativeFactor());
            nodes.add(optionNode);
        }
        edges.addAll(CanvasTopologyBuilder.buildEdges(factors, options));
        return new Canvas(nodes, edges);
    }

    private Map<String, Canvas.CanvasNode> indexNodes(Canvas canvas) {
        Map<String, Canvas.CanvasNode> nodes = new HashMap<>();
        if (canvas != null && canvas.getNodes() != null) {
            for (Canvas.CanvasNode node : canvas.getNodes()) {
                if (node != null && node.getId() != null) nodes.put(node.getId(), node);
            }
        }
        return nodes;
    }

    private Canvas.Position position(Map<String, Canvas.CanvasNode> oldNodes,
                                     String id, Canvas.Position defaultPos) {
        Canvas.CanvasNode oldNode = oldNodes.get(id);
        if (oldNode != null && oldNode.getPosition() != null) return oldNode.getPosition();
        return defaultPos;
    }

    private Canvas.CanvasNode node(String id, String type, String label,
                                   Canvas.Position position, Map<String, Object> data) {
        Canvas.CanvasNode node = new Canvas.CanvasNode();
        node.setId(id);
        node.setType(type);
        node.setLabel(label);
        node.setPosition(position);
        node.setData(data);
        return node;
    }

}
