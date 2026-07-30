package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;

import java.util.List;
import java.util.Map;

/** 工作流节点：提取关键因素。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FactorAnalysisNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;

    public record FactorAnalysisResult(List<Factor> factors) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        try {
            log.info("Node [FactorAnalysis] executing for decision: {}", state.getDecisionId());

        String understanding = state.getUnderstanding();
        String background = state.getBackground();

        String prompt = String.format(
            "基于以下决策问题背景和核心理解，请提取出影响该决策的最关键的 3-5 个因素。\n" +
            "背景：%s\n" +
            "核心理解：%s\n\n" +
            "要求：\n" +
            "1. 每个因素需要包含 id (英文字母下划线组合), name (简短名称), description (详细说明), weight (0到1之间的小数，所有因素权重之和为1)。\n" +
            "2. 以标准的 JSON 格式输出，不要包含任何额外的解释或Markdown格式。",
            background != null ? background : "无",
            understanding != null ? understanding : "无"
        );

        FactorAnalysisResult result = chatClient.prompt()
                .user(prompt)
                .call()
                .entity(FactorAnalysisResult.class);

            eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED"));
            return Map.of("factors", result.factors());
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        }
    }
}
