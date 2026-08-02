package qg.po.midterm.workflow;

import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import qg.po.midterm.dto.result.AnalysisResultDto;

import java.util.Map;

/**
 * AI 结果修复组件（PRD v2.0 第 12 章第 3 条）。
 *
 * <p>把「校验错误列表 + 原 JSON」一起发给大模型修复一次，而不是让它凭空重写。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisResultRepairer {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/repair.st")
    private Resource promptResource;

    /**
     * 基于错误列表与原结果，请求 AI 修复一次。
     *
     * @param errorMsg     校验错误描述
     * @param brokenResult 未通过校验的原始结果（可能含 null 字段）
     * @return 修复后的结果；AI 返回为空时兜底为空对象，由二次校验判定失败
     */
    public AnalysisResultDto repair(String errorMsg, AnalysisResultDto brokenResult) {
        Map<String, Object> params = Map.of(
                "errorMsg", errorMsg != null ? errorMsg : "未知错误",
                "originalJson", toJson(brokenResult)
        );
        String prompt = new PromptTemplate(promptResource).create(params).getContents();

        log.info(">>> 【AI Repair Prompt】\n{}", prompt);

        AnalysisResultDto repaired;
        try {
            repaired = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .entity(AnalysisResultDto.class);
        } catch (Exception e) {
            log.error("AI 修复调用失败", e);
            repaired = null;
        }

        log.info("<<< 【AI Repair Response】\n{}", repaired);

        return repaired != null ? repaired : new AnalysisResultDto();
    }

    private String toJson(AnalysisResultDto dto) {
        try {
            return objectMapper.writeValueAsString(dto != null ? dto : new AnalysisResultDto());
        } catch (Exception e) {
            log.warn("原结果序列化失败，返回空对象", e);
            return "{}";
        }
    }
}
