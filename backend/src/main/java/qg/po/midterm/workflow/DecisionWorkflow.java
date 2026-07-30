package qg.po.midterm.workflow;

import lombok.RequiredArgsConstructor;
import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.StateGraph;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.node.*;
import qg.po.midterm.workflow.state.DecisionState;

import jakarta.annotation.PostConstruct;
import java.util.Map;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;
import static org.bsc.langgraph4j.action.AsyncNodeAction.node_async;

/** 定义决策分析工作流的节点和执行顺序。 */
@Component
@RequiredArgsConstructor
public class DecisionWorkflow {

    private final RequirementAnalysisNode requirementAnalysisNode;
    private final FactorAnalysisNode factorAnalysisNode;
    private final OptionGenerationNode optionGenerationNode;
    private final RiskAnalysisNode riskAnalysisNode;
    private final ReportGenerationNode reportGenerationNode;
    private final RepairNode repairNode;

    private CompiledGraph<DecisionState> compiledGraph;

    @PostConstruct
    public void init() throws Exception {
        StateGraph<DecisionState> graph = new StateGraph<>(DecisionState::new);

        graph.addNode("UNDERSTAND", node_async(requirementAnalysisNode));
        graph.addNode("EXTRACT_FACTORS", node_async(factorAnalysisNode));
        graph.addNode("GENERATE_OPTIONS", node_async(optionGenerationNode));
        graph.addNode("COMPARE_OPTIONS", node_async(riskAnalysisNode));
        graph.addNode("GENERATE_REPORT", node_async(reportGenerationNode));
        graph.addNode("REPAIR", node_async(repairNode));

        graph.addEdge(START, "UNDERSTAND");
        graph.addEdge("UNDERSTAND", "EXTRACT_FACTORS");
        graph.addEdge("EXTRACT_FACTORS", "GENERATE_OPTIONS");
        graph.addEdge("GENERATE_OPTIONS", "COMPARE_OPTIONS");

        // 引入“一次修复”逻辑。若经过外部校验发现有 ErrorMsg，则走到 REPAIR
        graph.addConditionalEdges("COMPARE_OPTIONS",
            state -> {
                String errorMsg = state.getErrorMsg();
                return java.util.concurrent.CompletableFuture.completedFuture((errorMsg != null && !errorMsg.isEmpty()) ? "REPAIR" : "GENERATE_REPORT");
            },
            Map.of(
                "REPAIR", "REPAIR",
                "GENERATE_REPORT", "GENERATE_REPORT"
            )
        );

        graph.addEdge("REPAIR", "GENERATE_REPORT");
        graph.addEdge("GENERATE_REPORT", END);

        this.compiledGraph = graph.compile();
    }

    public CompiledGraph<DecisionState> getGraph() {
        return compiledGraph;
    }
}
