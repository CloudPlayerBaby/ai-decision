package qg.po.midterm.workflow.utils;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import qg.po.midterm.common.exception.AiValidationException;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
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
        return executeWithRepairResult(chatClient, userPrompt, tools, returnType).value();
    }

    public static <T> ExecutionResult<T> executeWithRepairResult(
            ChatClient chatClient,
            String userPrompt,
            Object[] tools,
            Class<T> returnType) {

        return executeWithRepairResult(chatClient, userPrompt, tools, returnType, result -> List.of());
    }

    /**
     * 执行结构化调用，并在 JSON 反序列化后校验业务字段。
     *
     * <p>部分模型会返回语法正确但字段为空的 JSON。此时也应进入同一次修复流程，
     * 避免将不完整结果当作节点成功结果继续向下游传递。</p>
     */
    public static <T> ExecutionResult<T> executeWithRepairResult(
            ChatClient chatClient,
            String userPrompt,
            Object[] tools,
            Class<T> returnType,
            Function<T, List<String>> validator) {

        MarkdownStrippingConverter<T> converter = new MarkdownStrippingConverter<>(returnType);
        String formatInstruction = converter.getFormat();
        String fullPrompt = userPrompt + "\n\n" + formatInstruction;

        // 1. 第一次请求
        String rawResponse;
        if (tools != null && tools.length > 0) {
            rawResponse = chatClient.prompt().user(fullPrompt)
                    .options(JsonOutputOptions.create())
                    .tools(tools).call().content();
        } else {
            rawResponse = chatClient.prompt().user(fullPrompt)
                    .options(JsonOutputOptions.create())
                    .call().content();
        }

        try {
            return new ExecutionResult<>(convertAndValidate(converter, rawResponse, validator), false);
        } catch (Exception e) {
            log.warn("大模型第一次返回非标准 JSON 格式，触发修复流程。报错: {}", e.getMessage());
            
            // 尝试提取缺失字段信息（针对 Jackson 的异常文本）
            List<String> missingFields = extractMissingFields(e.getMessage());

            // 2. 发起修复请求
            String repairPrompt = buildRepairPrompt(e.getMessage(), rawResponse, formatInstruction);

            String repairedRawResponse;
            if (tools != null && tools.length > 0) {
                repairedRawResponse = chatClient.prompt().user(repairPrompt)
                        .options(JsonOutputOptions.create())
                        .tools(tools).call().content();
            } else {
                repairedRawResponse = chatClient.prompt().user(repairPrompt)
                        .options(JsonOutputOptions.create())
                        .call().content();
            }

            try {
                return new ExecutionResult<>(convertAndValidate(converter, repairedRawResponse, validator), true);
            } catch (Exception e2) {
                log.error("大模型修复 JSON 失败: {}", e2.getMessage());
                throw new AiValidationException("AI 结果结构校验失败：" + e2.getMessage(), missingFields, true);
            }
        }
    }

    public record ExecutionResult<T>(T value, boolean repaired) {}

    private static <T> T convertAndValidate(
            MarkdownStrippingConverter<T> converter,
            String rawResponse,
            Function<T, List<String>> validator) {
        T result = converter.convert(rawResponse);
        List<String> errors = validator.apply(result);
        if (errors != null && !errors.isEmpty()) {
            throw new IllegalArgumentException("业务字段校验失败: " + String.join(", ", errors));
        }
        return result;
    }

    /**
     * 为节点级解析失败和工作流级语义校验失败构造统一的修复提示。
     */
    public static String buildRepairPrompt(String errorMessage, String originalJson, String formatInstruction) {
        return """
                下面的 JSON 未通过校验。请只修复错误涉及的字段，保留其余正确内容，不得删除、改名或新增 Schema 之外的字段。

                <validation_errors>
                %s
                </validation_errors>

                <original_json>
                %s
                </original_json>

                <required_format>
                %s
                </required_format>

                修复前请检查所有必填字段、ID 引用、列表数量、数值范围和权重总和。只返回一个符合 required_format 的 JSON 对象。
                """.formatted(
                errorMessage != null ? errorMessage : "未知校验错误",
                originalJson != null ? originalJson : "{}",
                formatInstruction != null ? formatInstruction : ""
        );
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
