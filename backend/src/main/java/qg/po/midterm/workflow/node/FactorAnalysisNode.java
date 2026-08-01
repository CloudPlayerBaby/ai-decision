package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.tools.TavilySearchTool;
import qg.po.midterm.workflow.tools.CalculatorTool;
import qg.po.midterm.workflow.tools.ExchangeRateTool;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

/**
 * 工作流节点：提取关键因素。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FactorAnalysisNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final TavilySearchTool tavilySearchTool;
    private final CalculatorTool calculatorTool;
    private final ExchangeRateTool exchangeRateTool;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/factor.st")
    private Resource promptResource;

    public record FactorAnalysisResult(
            @com.fasterxml.jackson.annotation.JsonPropertyDescription("不超过15个字的简短总结，例如：'已提取3个关键因素'")
            String summary,
            @com.fasterxml.jackson.annotation.JsonPropertyDescription("对本阶段提取因素的详细总结文本，适合直接展示给用户看")
            String content,
            List<Factor> factors
    ) {
    }

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));

            log.info("Node [FactorAnalysis] executing for decision: {}", state.getDecisionId());

            String title = state.data().containsKey("title") ? state.data().get("title").toString() : "未命名决策";
            String understanding = state.getUnderstanding();
            String background = state.getBackground();

            Map<String, Object> params = Map.of(
                    "title", title,
                    "background", background != null ? background : "无",
                    "understanding", understanding != null ? understanding : "无"
            );
            String prompt = new PromptTemplate(promptResource).create(params).getContents();

            log.info(">>> 【AI Prompt】\n{}", prompt);

            qg.po.midterm.workflow.utils.LlmRetryUtils.ExecutionResult<FactorAnalysisResult> execution =
                    qg.po.midterm.workflow.utils.LlmRetryUtils.executeWithRepairResult(
                    chatClient,
                    prompt,
                    new Object[]{tavilySearchTool, calculatorTool, exchangeRateTool},
                    FactorAnalysisResult.class
            );
            FactorAnalysisResult result = execution.value();

            log.info("<<< 【AI Response】\n{}", result);

            // 将大模型结果转换为 JSON 传入状态流，供前端渲染
            String outputData = objectMapper.writeValueAsString(result);
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "FactorAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, outputData));

            return Map.of(
                    "factors", result.factors() != null ? result.factors() : List.of(),
                    "repairAttempted", state.isRepairAttempted() || execution.repaired()
            );
        } catch (Exception e) {
            throw e;
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }
}
