package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 工作流节点：对比方案风险，生成最终推荐。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RiskAnalysisNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;

    public record RiskAnalysisResult(AnalysisResultDto.Recommendation recommendation, List<String> nextActions) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "RiskAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        try {
            log.info("Node [RiskAnalysis] executing for decision: {}", state.getDecisionId());

        String understanding = state.getUnderstanding();
        List<Option> options = state.getOptions();
        
        String optionStr = options == null ? "无" : options.stream()
            .map(o -> String.format("- 方案ID: %s, 名称: %s, 描述: %s", o.getId(), o.getName(), o.getDescription()))
            .collect(Collectors.joining("\n"));

        String prompt = String.format(
            "基于以下决策核心理解以及生成的候选方案，请进行最终的风险对比与推荐。\n" +
            "核心理解：%s\n" +
            "候选方案：\n%s\n\n" +
            "要求：\n" +
            "1. 必须提供 recommendation (推荐方案)，包含 optionId (必须是上面提供的方案ID之一) 和 reason (推荐理由)。\n" +
            "2. 必须提供 nextActions (下一步行动建议)，包含 3-5 条具体可落地的后续行动。\n" +
            "3. 以标准的 JSON 格式输出，不要包含任何额外的解释或Markdown格式。",
            understanding != null ? understanding : "无",
            optionStr
        );

        RiskAnalysisResult result = chatClient.prompt()
                .user(prompt)
                .call()
                .entity(RiskAnalysisResult.class);

            eventPublisher.publishEvent(new NodeExecutionEvent(this, "RiskAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED"));
            return Map.of(
                "recommendation", result.recommendation(),
                "nextActions", result.nextActions()
            );
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "RiskAnalysis", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        }
    }
}
