package qg.po.midterm.workflow.utils;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import qg.po.midterm.common.exception.AiValidationException;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 封装大模型调用的自动修复逻辑
 */
@Slf4j
public class LlmRetryUtils {

    private static final Pattern MISSING_PROPERTY_PATTERN = Pattern.compile("Missing required creator property '(.*?)'");

    /**
     * 带 1 次自动修复机制执行大模型调用
     *
     * @param chatClient Spring AI ChatClient 实例
     * @param userPrompt 用户原始 Prompt
     * @param tools      所需挂载的工具数组
     * @param returnType 期望转换的返回类型
     * @param <T>        返回结果类型
     * @return 执行并转换成功后的结果
     */
    public static <T> T executeWithRepair(
            ChatClient chatClient,
            String userPrompt,
            Object[] tools,
            Class<T> returnType) {

        MarkdownStrippingConverter<T> converter = new MarkdownStrippingConverter<>(returnType);
        String formatInstruction = converter.getFormat();
        String fullPrompt = userPrompt + "\n\n" + formatInstruction;

        // 1. 第一次请求
        String rawResponse;
        if (tools != null && tools.length > 0) {
            rawResponse = chatClient.prompt().user(fullPrompt).tools(tools).call().content();
        } else {
            rawResponse = chatClient.prompt().user(fullPrompt).call().content();
        }

        try {
            return converter.convert(rawResponse);
        } catch (Exception e) {
            log.warn("大模型第一次返回非标准 JSON 格式，触发修复流程。报错: {}", e.getMessage());
            
            // 尝试提取缺失字段信息（针对 Jackson 的异常文本）
            List<String> missingFields = extractMissingFields(e.getMessage());

            // 2. 发起修复请求
            String repairPrompt = String.format(
                    "你需要返回一个严格符合 JSON Schema 的结果。\n" +
                    "上次你返回的结果在解析时报错了，错误信息如下：\n%s\n\n" +
                    "你上次返回的原始内容如下：\n%s\n\n" +
                    "请根据错误信息修复 JSON，并再次返回（注意仅返回合法的 JSON，不要包裹多余文本）。\n%s",
                    e.getMessage(), rawResponse, formatInstruction
            );

            String repairedRawResponse;
            if (tools != null && tools.length > 0) {
                repairedRawResponse = chatClient.prompt().user(repairPrompt).tools(tools).call().content();
            } else {
                repairedRawResponse = chatClient.prompt().user(repairPrompt).call().content();
            }

            try {
                return converter.convert(repairedRawResponse);
            } catch (Exception e2) {
                log.error("大模型修复 JSON 失败: {}", e2.getMessage());
                throw new AiValidationException("AI 结果结构校验失败：" + e2.getMessage(), missingFields, true);
            }
        }
    }

    private static List<String> extractMissingFields(String errorMessage) {
        List<String> missingFields = new ArrayList<>();
        if (errorMessage == null) return missingFields;
        Matcher matcher = MISSING_PROPERTY_PATTERN.matcher(errorMessage);
        while (matcher.find()) {
            missingFields.add(matcher.group(1));
        }
        return missingFields;
    }
}
