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
import qg.po.midterm.workflow.tools.TavilySearchTool;

import java.util.List;
import java.util.Map;

/** 工作流节点：提取关键因素。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FactorAnalysisNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final TavilySearchTool tavilySearchTool;

    @Value("classpath:prompts/factor.st")
    private Resource promptResource;

    public record FactorAnalysisResult(List<Factor> factors) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));
            
            log.info("Node [FactorAnalysis] executing for decision: {}", state.getDecisionId());

            String understanding = state.getUnderstanding();
            String background = state.getBackground();

            Map<String, Object> params = Map.of(
                "background", background != null ? background : "无",
                "understanding", understanding != null ? understanding : "无"
            );
            String prompt = new PromptTemplate(promptResource).create(params).getContents();
            
            log.info(">>> 【AI Prompt】\n{}", prompt);

            FactorAnalysisResult result = qg.po.midterm.workflow.utils.LlmRetryUtils.withJsonRetry(3, () ->
                    chatClient.prompt()
                            .user(prompt)
                            .tools(tavilySearchTool)
                            .call()
                            .entity(FactorAnalysisResult.class)
            );
                    
            log.info("<<< 【AI Response】\n{}", result);

            // 将大模型结果转换为 JSON 传入状态流，供前端渲染
            String outputData = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(Map.of("factors", result.factors()));
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, outputData));
            
            return Map.of("factors", result.factors());
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }
}
