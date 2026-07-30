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

import java.util.Map;

/** 工作流节点：综合所有信息，生成最终总结报告。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportGenerationNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;

    @Value("classpath:prompts/report.st")
    private Resource promptResource;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        try {
            log.info("Node [ReportGeneration] executing for decision: {}", state.getDecisionId());

        String understanding = state.getUnderstanding();
        
        Map<String, Object> params = Map.of(
            "understanding", understanding != null ? understanding : "无"
        );
        String prompt = new PromptTemplate(promptResource).create(params).getContents();
        
        log.info(">>> 【AI Prompt】\n{}", prompt);

        String reportSummary = chatClient.prompt()
                .user(prompt)
                .call()
                .content();
                
        log.info("<<< 【AI Response】\n{}", reportSummary);

        // 将大模型结果转换为 JSON 传入状态流，供前端渲染
        String outputData = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(Map.of("reportSummary", reportSummary));
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, outputData));
            // 实际生成报告可能需要保存到特定实体中，这里先作为结果之一存入 State
            return Map.of("reportSummary", reportSummary);
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        }
    }
}
