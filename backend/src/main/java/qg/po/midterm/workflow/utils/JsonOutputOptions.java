package qg.po.midterm.workflow.utils;

import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;

/**
 * 为需要映射成 Java 对象的模型调用启用 JSON Object 输出模式。
 */
public final class JsonOutputOptions {

    private JsonOutputOptions() {
    }

    public static OpenAiChatOptions.Builder create() {
        OpenAiChatOptions.Builder builder = OpenAiChatOptions.builder();
        builder.responseFormat(OpenAiChatModel.ResponseFormat.builder()
                .type(OpenAiChatModel.ResponseFormat.Type.JSON_OBJECT)
                .build());
        return builder;
    }
}
