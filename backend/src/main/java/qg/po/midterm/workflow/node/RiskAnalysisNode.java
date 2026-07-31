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

    public record RiskAnalysisResult(
            @com.fasterxml.jackson.annotation.JsonPropertyDescription("不超过15个字的简短总结，例如：'已完成风险评估与对比'")
            String summary,
            @com.fasterxml.jackson.annotation.JsonPropertyDescription("对本阶段评估对比结果的详细总结文本，适合直接展示给用户看，主要概括你最终推荐的方案及其核心理由")
            String content,
            AnalysisResultDto.Recommendation recommendation, 
            List<String> nextActions
    ) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "RiskAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));
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

            qg.po.midterm.workflow.utils.LlmRetryUtils.ExecutionResult<RiskAnalysisResult> execution =
                    qg.po.midterm.workflow.utils.LlmRetryUtils.executeWithRepairResult(
                    chatClient,
                    prompt,
                    null, // 没有 tools
                    RiskAnalysisResult.class
            );
            RiskAnalysisResult result = execution.value();
                    
            log.info("<<< 【AI Response】\n{}", result);

            // 将大模型结果转换为 JSON 传入状态流，供前端渲染
            String outputData = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(result);
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "RiskAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, outputData));
            
            return Map.of(
                "recommendation", result.recommendation() != null
                        ? result.recommendation() : new AnalysisResultDto.Recommendation(),
                "nextActions", result.nextActions() != null ? result.nextActions() : List.of(),
                "repairAttempted", state.isRepairAttempted() || execution.repaired()
            );
        } catch (Exception e) {
            throw e;
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }
}
