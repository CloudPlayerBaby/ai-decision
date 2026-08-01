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
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

/** 工作流节点：理解用户的决策问题和目标。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RequirementAnalysisNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final CalculatorTool calculatorTool;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/requirement.st")
    private Resource promptResource;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "RequirementAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));
            log.info("Node [RequirementAnalysis] executing for decision: {}", state.getDecisionId());

        String title = state.data().containsKey("title") ? state.data().get("title").toString() : "未命名决策";
        String background = state.getBackground() != null ? state.getBackground() : "无";
        String goal = state.getGoal() != null ? state.getGoal() : "未明确";
        String constraints = state.getConstraints() != null ? state.getConstraints() : "无";

        Map<String, Object> params = Map.of(
            "title", title,
            "background", background,
            "goal", goal,
            "constraints", constraints
        );
        String prompt = new PromptTemplate(promptResource).create(params).getContents();
        
        log.info(">>> 【AI Prompt】\n{}", prompt);

        qg.po.midterm.workflow.utils.LlmRetryUtils.ExecutionResult<RequirementAnalysisResult> execution =
                qg.po.midterm.workflow.utils.LlmRetryUtils.executeWithRepairResult(
                        chatClient, prompt, new Object[]{calculatorTool}, RequirementAnalysisResult.class);
        RequirementAnalysisResult result = execution.value();
                
        log.info("<<< 【AI Response】\n{}", result);

        // 使用 ObjectMapper 将结果序列化为 JSON 字符串
        String outputData = objectMapper.writeValueAsString(result);

        eventPublisher.publishEvent(new NodeExecutionEvent(this, "RequirementAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, outputData));
        return Map.of(
                "understanding", result.understanding() != null ? result.understanding() : "",
                "repairAttempted", state.isRepairAttempted() || execution.repaired()
        );
        } catch (Exception e) {
            throw e;
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }
}
