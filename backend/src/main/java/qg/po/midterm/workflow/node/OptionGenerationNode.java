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
import qg.po.midterm.workflow.state.Option;
import qg.po.midterm.workflow.tools.CalculatorTool;
import qg.po.midterm.workflow.tools.ExchangeRateTool;
import qg.po.midterm.workflow.utils.AnalysisResultValidator;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 工作流节点：生成候选决策方案。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OptionGenerationNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final CalculatorTool calculatorTool;
    private final ExchangeRateTool exchangeRateTool;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/option.st")
    private Resource promptResource;

    @Value("${app.demo.fail-option-generation-once:false}")
    private boolean failOptionGenerationOnce;

    private final Set<String> demoFailedTaskIds = ConcurrentHashMap.newKeySet();

    public record OptionGenerationResult(
            @com.fasterxml.jackson.annotation.JsonPropertyDescription("不超过15个字的简短总结，例如：'已生成3个候选方案'")
            String summary,
            @com.fasterxml.jackson.annotation.JsonPropertyDescription("对本阶段生成方案的详细总结文本，适合直接展示给用户看")
            String content,
            List<Option> options
    ) {
    }

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "OptionGeneration", state.getDecisionId(), state.getTaskId(), "RUNNING"));
            log.info("Node [OptionGeneration] executing for decision: {}", state.getDecisionId());

            if (failOptionGenerationOnce && demoFailedTaskIds.add(state.getTaskId())) {
                throw new IllegalStateException("Demo failure: option generation failed once for retry verification");
            }

            String understanding = state.getUnderstanding();
            String constraints = state.getConstraints();
            List<Factor> factors = state.getFactors();

            String factorStr = factors == null ? "无" : factors.stream()
                    .map(f -> String.format("- %s (权重: %.2f): %s", f.getName(), f.getWeight(), f.getDescription()))
                    .collect(Collectors.joining("\n"));

            String title = state.data().containsKey("title") ? state.data().get("title").toString() : "未命名决策";

            Map<String, Object> params = Map.of(
                    "title", title,
                    "understanding", understanding != null ? understanding : "无",
                    "constraints", constraints != null ? constraints : "无",
                    "factors", factorStr
            );
            String prompt = new PromptTemplate(promptResource).create(params).getContents();

            log.info(">>> 【AI Prompt】\n{}", prompt);

            qg.po.midterm.workflow.utils.LlmRetryUtils.ExecutionResult<OptionGenerationResult> execution =
                    qg.po.midterm.workflow.utils.LlmRetryUtils.executeWithRepairResult(
                            chatClient,
                            prompt,
                            new Object[]{calculatorTool, exchangeRateTool},
                            OptionGenerationResult.class,
                            result -> AnalysisResultValidator.validateOptions(result.options())
                    );
            OptionGenerationResult result = execution.value();

            log.info("<<< 【AI Response】\n{}", result);

            // 将大模型结果转换为 JSON 传入状态流，供前端渲染
            String outputData = objectMapper.writeValueAsString(result);
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "OptionGeneration", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, outputData));
            return Map.of(
                    "options", result.options() != null ? result.options() : List.of(),
                    "repairAttempted", state.isRepairAttempted() || execution.repaired()
            );
        } catch (Exception e) {
            throw e;
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }
}
