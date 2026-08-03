package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import qg.po.midterm.common.exception.AiValidationException;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.utils.LlmRetryUtils;
import qg.po.midterm.workflow.utils.MarkdownStrippingConverter;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

/**
 * 工作流节点：修复校验失败的结果。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RepairNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        // 注：遵循 PRD 12 节，Repair 节点为引擎内部节点，不抛出 NodeExecutionEvent
        // 它的核心职责是接收 ValidateNode 打回的错题本 (errorMsg)，然后喂给大模型重新做题。
        log.info("Node [Repair] executing for decision: {}", state.getDecisionId());

        String errorMsg = state.getErrorMsg();
        int retryCount = state.getRetryCount();

        // 将之前大模型写错的数据结构，配合具体的错误提示传给大模型
        AnalysisResultDto originalResult = new AnalysisResultDto();
        originalResult.setUnderstanding(state.getUnderstanding());
        originalResult.setFactors(state.getFactors());
        originalResult.setOptions(state.getOptions());
        originalResult.setRecommendation(state.getRecommendation());
        originalResult.setNextActions(state.getNextActions());
        String originalJson = objectMapper.writeValueAsString(originalResult);
        MarkdownStrippingConverter<AnalysisResultDto> converter =
                new MarkdownStrippingConverter<>(AnalysisResultDto.class);
        String prompt = LlmRetryUtils.buildRepairPrompt(errorMsg, originalJson, converter.getFormat());

        log.info(">>> 【AI Prompt】\n{}", prompt);

        AnalysisResultDto repairedResult;
        try {
            repairedResult = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .entity(converter);
        } catch (Exception exception) {
            throw new AiValidationException(
                    "AI 结果修复后仍无法解析：" + exception.getMessage(),
                    parseMissingFields(errorMsg),
                    true
            );
        }

        log.info("<<< 【AI Response】\n{}", repairedResult);

        return Map.of(
                "understanding", repairedResult.getUnderstanding() != null ? repairedResult.getUnderstanding() : "",
                "factors", repairedResult.getFactors() != null ? repairedResult.getFactors() : List.of(),
                "options", repairedResult.getOptions() != null ? repairedResult.getOptions() : List.of(),
                "recommendation", repairedResult.getRecommendation() != null ? repairedResult.getRecommendation() : new AnalysisResultDto.Recommendation(),
                "nextActions", repairedResult.getNextActions() != null ? repairedResult.getNextActions() : List.of(),
                "retryCount", retryCount + 1,
                "repairAttempted", true,
                "errorMsg", "" // 修复后清空 errorMsg，流转回 ValidateNode 进行二次校验
        );
    }

    private List<String> parseMissingFields(String errorMsg) {
        if (errorMsg == null || errorMsg.isBlank()) return List.of();
        return errorMsg.lines()
                .map(String::trim)
                .filter(line -> line.startsWith("- "))
                .map(line -> line.substring(2))
                .toList();
    }
}
