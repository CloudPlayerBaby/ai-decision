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

import java.util.Map;

/** 工作流节点：修复校验失败的结果。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RepairNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;

    @Value("classpath:prompts/repair.st")
    private Resource promptResource;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "Repair", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        try {
            log.info("Node [Repair] executing for decision: {}", state.getDecisionId());

        String errorMsg = state.getErrorMsg();
        int retryCount = state.getRetryCount();

        if (retryCount >= 1) {
            throw new RuntimeException("一次修复失败，任务终止。错误原因: " + errorMsg);
        }

        Map<String, Object> params = Map.of(
            "errorMsg", errorMsg != null ? errorMsg : "未知错误"
        );
        String prompt = new PromptTemplate(promptResource).create(params).getContents();
        
        log.info(">>> 【AI Prompt】\n{}", prompt);

        AnalysisResultDto repairedResult = chatClient.prompt()
                .user(prompt)
                .call()
                .entity(AnalysisResultDto.class);
                
        log.info("<<< 【AI Response】\n{}", repairedResult);

            eventPublisher.publishEvent(new NodeExecutionEvent(this, "Repair", state.getDecisionId(), state.getTaskId(), "SUCCEEDED"));
            return Map.of(
                "understanding", repairedResult.getUnderstanding(),
                "factors", repairedResult.getFactors(),
                "options", repairedResult.getOptions(),
                "recommendation", repairedResult.getRecommendation(),
                "nextActions", repairedResult.getNextActions(),
                "retryCount", retryCount + 1,
                "errorMsg", "" // Clear error after successful repair
            );
        } catch (Exception e) {
            eventPublisher.publishEvent(new NodeExecutionEvent(this, "Repair", state.getDecisionId(), state.getTaskId(), "FAILED", e.getMessage()));
            throw e;
        }
    }
}
