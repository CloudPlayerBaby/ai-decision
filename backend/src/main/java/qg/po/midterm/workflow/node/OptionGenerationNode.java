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
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 工作流节点：生成候选决策方案。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OptionGenerationNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;

    @Value("classpath:prompts/option.st")
    private Resource promptResource;

    public record OptionGenerationResult(List<Option> options) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "OptionGeneration", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        try {
            log.info("Node [OptionGeneration] executing for decision: {}", state.getDecisionId());

        String understanding = state.getUnderstanding();
        String constraints = state.getConstraints();
        List<Factor> factors = state.getFactors();
        
        String factorStr = factors == null ? "无" : factors.stream()
            .map(f -> String.format("- %s (权重: %.2f): %s", f.getName(), f.getWeight(), f.getDescription()))
            .collect(Collectors.joining("\n"));

        Map<String, Object> params = Map.of(
            "understanding", understanding != null ? understanding : "无",
            "constraints", constraints != null ? constraints : "无",
            "factors", factorStr
        );
        String prompt = new PromptTemplate(promptResource).create(params).getContents();
        
        log.info(">>> 【AI Prompt】\n{}", prompt);

        OptionGenerationResult result = qg.po.midterm.workflow.utils.LlmRetryUtils.withJsonRetry(3, () ->
                chatClient.prompt()
                        .user(prompt)
                        .call()
                        .entity(OptionGenerationResult.class)
        );
                
        log.info("<<< 【AI Response】\n{}", result);

            eventPublisher.publishEvent(new NodeExecutionEvent(this, "OptionGeneration", state.getDecisionId(), state.getTaskId(), "SUCCEEDED"));
            return Map.of("options", result.options());
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "OptionGeneration", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        }
    }
}
