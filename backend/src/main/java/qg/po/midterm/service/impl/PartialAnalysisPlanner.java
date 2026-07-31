package qg.po.midterm.service.impl;

import org.springframework.stereotype.Component;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Plans a partial run from business node types instead of ID prefixes. */
@Component
public class PartialAnalysisPlanner {

    public Plan plan(Canvas canvas, AnalysisResultDto currentResult, List<String> changedNodeIds) {
        Map<String, String> nodeTypes = indexNodeTypes(canvas, currentResult);
        Set<String> affected = new LinkedHashSet<>(changedNodeIds);

        boolean factorChanged = false;
        boolean optionChanged = false;
        boolean fullAnalysisRequired = false;
        for (String changedNodeId : changedNodeIds) {
            String type = nodeTypes.get(changedNodeId);
            if ("factor".equals(type)) {
                factorChanged = true;
            } else if ("option".equals(type)) {
                optionChanged = true;
            } else {
                fullAnalysisRequired = true;
            }
        }

        String startNode;
        if (fullAnalysisRequired) {
            startNode = "UNDERSTAND";
            affected.addAll(nodeTypes.keySet());
        } else if (factorChanged) {
            startNode = "GENERATE_OPTIONS";
            nodeTypes.forEach((id, type) -> {
                if ("option".equals(type)) affected.add(id);
            });
        } else if (optionChanged) {
            startNode = "COMPARE_OPTIONS";
        } else {
            startNode = "UNDERSTAND";
            affected.addAll(nodeTypes.keySet());
        }
        return new Plan(startNode, new ArrayList<>(affected));
    }

    private Map<String, String> indexNodeTypes(Canvas canvas, AnalysisResultDto result) {
        Map<String, String> types = new LinkedHashMap<>();
        if (result != null && result.getFactors() != null) {
            for (Factor factor : result.getFactors()) {
                if (factor != null && factor.getId() != null) types.put(factor.getId(), "factor");
            }
        }
        if (result != null && result.getOptions() != null) {
            for (Option option : result.getOptions()) {
                if (option != null && option.getId() != null) types.put(option.getId(), "option");
            }
        }
        if (canvas != null && canvas.getNodes() != null) {
            for (Canvas.CanvasNode node : canvas.getNodes()) {
                if (node != null && node.getId() != null && node.getType() != null) {
                    types.put(node.getId(), node.getType().toLowerCase(Locale.ROOT));
                }
            }
        }
        return types;
    }

    public record Plan(String startNode, List<String> affectedNodeIds) {}
}
