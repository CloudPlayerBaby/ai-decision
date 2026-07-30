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
import qg.po.midterm.workflow.tools.CalculatorTool;

import java.util.Map;

/** 工作流节点：理解用户的决策问题和目标。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RequirementAnalysisNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final CalculatorTool calculatorTool;

    @Value("classpath:prompts/requirement.st")
    private Resource promptResource;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "RequirementAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        try {
            log.info("Node [RequirementAnalysis] executing for decision: {}", state.getDecisionId());

        String background = state.getBackground() != null ? state.getBackground() : "无";
        String goal = state.getGoal() != null ? state.getGoal() : "未明确";
        String constraints = state.getConstraints() != null ? state.getConstraints() : "无";

        Map<String, Object> params = Map.of(
            "background", background,
            "goal", goal,
            "constraints", constraints
        );
        String prompt = new PromptTemplate(promptResource).create(params).getContents();
        
        log.info(">>> 【AI Prompt】\n{}", prompt);

        String understanding = chatClient.prompt()
                .user(prompt)
                .tools(calculatorTool)
                .call()
                .content();
                
        log.info("<<< 【AI Response】\n{}", understanding);

            eventPublisher.publishEvent(new NodeExecutionEvent(this, "RequirementAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED"));
            return Map.of("understanding", understanding);
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "RequirementAnalysis", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        }
    }
}
