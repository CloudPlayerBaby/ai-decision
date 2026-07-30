package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import org.springframework.context.ApplicationEventPublisher;
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

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "Repair", state.getDecisionId(), state.getTaskId(), "STARTED"));
        log.info("Node [Repair] executing for decision: {}", state.getDecisionId());

        String errorMsg = state.getErrorMsg();
        int retryCount = state.getRetryCount();

        if (retryCount >= 1) {
            throw new RuntimeException("一次修复失败，任务终止。错误原因: " + errorMsg);
        }

        String prompt = String.format(
            "之前生成的 JSON 结果未能通过严格的 Schema 校验。请根据以下错误信息进行修复，并返回正确的 JSON。\n" +
            "错误信息：%s\n\n" +
            "要求：\n" +
            "请直接输出修复后的标准 JSON 格式，不要包含任何额外的解释或 Markdown 格式。",
            errorMsg != null ? errorMsg : "未知错误"
        );

        AnalysisResultDto repairedResult = chatClient.prompt()
                .user(prompt)
                .call()
                .entity(AnalysisResultDto.class);

        eventPublisher.publishEvent(new NodeExecutionEvent(this, "Repair", state.getDecisionId(), state.getTaskId(), "FINISHED"));
        return Map.of(
            "understanding", repairedResult.getUnderstanding(),
            "factors", repairedResult.getFactors(),
            "options", repairedResult.getOptions(),
            "recommendation", repairedResult.getRecommendation(),
            "nextActions", repairedResult.getNextActions(),
            "retryCount", retryCount + 1,
            "errorMsg", "" // Clear error after successful repair
        );
    }
}
