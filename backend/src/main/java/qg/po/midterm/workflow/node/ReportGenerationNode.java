package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import org.springframework.context.ApplicationEventPublisher;
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

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        try {
            log.info("Node [ReportGeneration] executing for decision: {}", state.getDecisionId());

        String understanding = state.getUnderstanding();
        
        String prompt = String.format(
            "基于你对问题的核心理解：%s\n" +
            "请写一段正式的决策结论报告摘要（大约300字），用于作为最终报告的 Executive Summary。",
            understanding != null ? understanding : "无"
        );

        String reportSummary = chatClient.prompt()
                .user(prompt)
                .call()
                .content();

            eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "SUCCEEDED"));
            // 实际生成报告可能需要保存到特定实体中，这里先作为结果之一存入 State
            return Map.of("reportSummary", reportSummary);
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "ReportGeneration", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        }
    }
}
