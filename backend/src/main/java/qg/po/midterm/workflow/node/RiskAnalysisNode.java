package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.ai.chat.prompt.PromptTemplate;
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

    @Value("classpath:prompts/risk.st")
    private Resource promptResource;

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

        Map<String, Object> params = Map.of(
            "understanding", understanding != null ? understanding : "无",
            "options", optionStr
        );
        String prompt = new PromptTemplate(promptResource).create(params).getContents();
        
        log.info(">>> 【AI Prompt】\n{}", prompt);

        RiskAnalysisResult result = chatClient.prompt()
                .user(prompt)
                .call()
                .entity(RiskAnalysisResult.class);
                
        log.info("<<< 【AI Response】\n{}", result);

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
