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

import java.util.List;
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
        // 注：遵循 PRD 12 节，Repair 节点为引擎内部节点，不抛出 NodeExecutionEvent
        // 它的核心职责是接收 ValidateNode 打回的错题本 (errorMsg)，然后喂给大模型重新做题。
        log.info("Node [Repair] executing for decision: {}", state.getDecisionId());

        String errorMsg = state.getErrorMsg();
        int retryCount = state.getRetryCount();

        // 将之前大模型写错的数据结构，配合具体的错误提示传给大模型
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

        return Map.of(
            "understanding", repairedResult.getUnderstanding() != null ? repairedResult.getUnderstanding() : "",
            "factors", repairedResult.getFactors() != null ? repairedResult.getFactors() : List.of(),
            "options", repairedResult.getOptions() != null ? repairedResult.getOptions() : List.of(),
            "recommendation", repairedResult.getRecommendation() != null ? repairedResult.getRecommendation() : new AnalysisResultDto.Recommendation(),
            "nextActions", repairedResult.getNextActions() != null ? repairedResult.getNextActions() : List.of(),
            "retryCount", retryCount + 1,
            "errorMsg", "" // 修复后清空 errorMsg，流转回 ValidateNode 进行二次校验
        );
    }
}
