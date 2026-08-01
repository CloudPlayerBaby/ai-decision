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
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

/** 工作流节点：综合所有信息，生成最终总结报告。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportGenerationNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/report.st")
    private Resource promptResource;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "RUNNING"));
            log.info("Node [ReportGeneration] executing for decision: {}", state.getDecisionId());

            String analysisResult = objectMapper.writeValueAsString(Map.of(
                    "understanding", state.getUnderstanding() != null ? state.getUnderstanding() : "",
                    "factors", state.getFactors() != null ? state.getFactors() : List.of(),
                    "options", state.getOptions() != null ? state.getOptions() : List.of(),
                    "recommendation", state.getRecommendation() != null
                            ? state.getRecommendation() : new AnalysisResultDto.Recommendation(),
                    "nextActions", state.getNextActions() != null ? state.getNextActions() : List.of()
            ));

            Map<String, Object> params = Map.of(
                "analysisResult", analysisResult
            );
            String prompt = new PromptTemplate(promptResource).create(params).getContents();
            
            log.info(">>> 【AI Prompt】\n{}", prompt);

            String reportSummary = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
                    
            log.info("<<< 【AI Response】\n{}", reportSummary);

            // 将大模型结果转换为 JSON 传入状态流，供前端渲染
            String outputData = objectMapper.writeValueAsString(Map.of("reportSummary", reportSummary));
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, outputData));
            // 实际生成报告可能需要保存到特定实体中，这里先作为结果之一存入 State
            return Map.of("reportSummary", reportSummary);
        } catch (Exception e) {
            throw e;
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }
}
