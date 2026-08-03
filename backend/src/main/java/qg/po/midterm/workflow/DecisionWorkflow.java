package qg.po.midterm.workflow;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.StateGraph;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.node.*;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;
import static org.bsc.langgraph4j.action.AsyncNodeAction.node_async;

/**
 * 定义决策分析工作流的节点和执行顺序。
 */
@Component
@RequiredArgsConstructor
public class DecisionWorkflow {

    private final RequirementAnalysisNode requirementAnalysisNode;
    private final FactorAnalysisNode factorAnalysisNode;
    private final OptionGenerationNode optionGenerationNode;
    private final OptionReevaluationNode optionReevaluationNode;
    private final OptionEnrichmentNode optionEnrichmentNode;
    private final RiskAnalysisNode riskAnalysisNode;
    private final RepairNode repairNode;
    private final ValidateNode validateNode;

    private CompiledGraph<DecisionState> compiledGraph;

    @PostConstruct
    public void init() throws Exception {
        StateGraph<DecisionState> graph = new StateGraph<>(DecisionState::new);

        graph.addNode("UNDERSTAND", node_async(requirementAnalysisNode));
        graph.addNode("EXTRACT_FACTORS", node_async(factorAnalysisNode));
        graph.addNode("GENERATE_OPTIONS", node_async(optionGenerationNode));
        graph.addNode("REEVALUATE_OPTIONS", node_async(optionReevaluationNode));
        graph.addNode("ENRICH_OPTIONS", node_async(optionEnrichmentNode));
        graph.addNode("COMPARE_OPTIONS", node_async(riskAnalysisNode));
        graph.addNode("REPAIR", node_async(repairNode));
        graph.addNode("VALIDATE", node_async(validateNode));

        /*
         * =====================================================================================
         * 1. 动态入口路由 (Dynamic Start Routing)
         * =====================================================================================
         * 对应 PRD 10.3 (局部重推)。
         * 我们并没有将 START 节点固定连接到 UNDERSTAND。
         * 而是利用条件路由，读取 State 中的 `startNode` 变量（由 C 组业务层组装）。
         * - 如果传入 UNDERSTAND：走全量推演（背景分析->因素提取->方案生成...）。
         * - 如果传入 GENERATE_OPTIONS：跳过前置背景分析，直接重新生成方案（因为用户可能只改了某个“因素”）。
         * - 如果传入 COMPARE_OPTIONS：跳过生成，只基于用户自己修改的方案，重新打分。
         */
        graph.addConditionalEdges(START,
                state -> {
                    String startNode = state.value("startNode").map(Object::toString).orElse("UNDERSTAND");
                    return CompletableFuture.completedFuture(startNode);
                },
                Map.of(
                        "UNDERSTAND", "UNDERSTAND",
                        "EXTRACT_FACTORS", "EXTRACT_FACTORS",
                        "GENERATE_OPTIONS", "GENERATE_OPTIONS",
                        "REEVALUATE_OPTIONS", "REEVALUATE_OPTIONS",
                        "ENRICH_OPTIONS", "ENRICH_OPTIONS",
                        "COMPARE_OPTIONS", "COMPARE_OPTIONS"
                )
        );

        /*
         * =====================================================================================
         * 2. 标准的串行思维链 (Chain of Thought)
         * =====================================================================================
         * 强制依赖顺序：理解 -> 拆解因素 -> 生成方案 -> 对比方案
         */
        graph.addEdge("UNDERSTAND", "EXTRACT_FACTORS");
        graph.addEdge("EXTRACT_FACTORS", "GENERATE_OPTIONS");
        graph.addEdge("GENERATE_OPTIONS", "COMPARE_OPTIONS");
        graph.addEdge("REEVALUATE_OPTIONS", "COMPARE_OPTIONS");
        graph.addEdge("ENRICH_OPTIONS", "COMPARE_OPTIONS");

        /*
         * =====================================================================================
         * 3. 强校验与 AI 自我修复死循环 (Self-Healing Loop)
         * =====================================================================================
         * 对应 PRD 12 节。
         * 无论是首次对比(COMPARE_OPTIONS)，还是后续修复(REPAIR)，只要大模型吐出了数据，
         * 必须强制进入 VALIDATE 节点进行海关审查。
         */
        graph.addEdge("COMPARE_OPTIONS", "VALIDATE");
        graph.addEdge("REPAIR", "VALIDATE");

        /*
         * 审查后的条件分流：
         * - 如果 errorMsg 存在，说明数据残缺，导流去 REPAIR 节点让 AI 修补。
         * - 如果 errorMsg 为空，说明完美符合 PRD 12.1 规范，放行结束！
         */
        graph.addConditionalEdges("VALIDATE",
                state -> {
                    String errorMsg = state.getErrorMsg();
                    return java.util.concurrent.CompletableFuture.completedFuture((errorMsg != null && !errorMsg.isEmpty()) ? "REPAIR" : END);
                },
                Map.of(
                        "REPAIR", "REPAIR",
                        END, END
                )
        );

        this.compiledGraph = graph.compile();
    }

    public CompiledGraph<DecisionState> getGraph() {
        return compiledGraph;
    }
}
