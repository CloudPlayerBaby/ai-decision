package qg.po.midterm.workflow.utils;

import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.lang.NonNull;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 带 Markdown 预处理能力的 JSON 转换器。
 *
 * <p>大模型（如 Gemini、GPT 等）在返回内容时，经常习惯性地将 JSON 包裹在
 * Markdown 代码块中（如 ```json ... ```）。Spring AI 原生的 {@link BeanOutputConverter}
 * 无法处理这种情况，会导致 Jackson 解析异常。
 *
 * <p>本类在执行真正的 JSON 反序列化前，会自动截取 {@code {} 之间的 JSON 内容，
 * 剥离掉 json 标签，确保即使模型以非标准格式返回，系统也能正常解析。
 *
 * @param <T> 目标 Java 类型
 */
public class MarkdownStrippingConverter<T> extends BeanOutputConverter<T> {

    // 匹配 ```json ... ``` 或 ``` ... ``` 代码块中的内容
    private static final Pattern CODE_BLOCK_PATTERN =
            Pattern.compile("```(?:json)?\\s*(\\{[\\s\\S]*?})\\s*```", Pattern.DOTALL);

    // 直接匹配裸 JSON 对象（兜底）
    private static final Pattern JSON_OBJECT_PATTERN =
            Pattern.compile("(\\{[\\s\\S]*})", Pattern.DOTALL);

    public MarkdownStrippingConverter(Class<T> clazz) {
        super(clazz);
    }

    /**
     * 先剥离 Markdown 外壳，再交由父类反序列化。
     */
    @Override
    public T convert(@NonNull String source) {
        String cleaned = stripMarkdown(source);
        return super.convert(cleaned);
    }

    /**
     * 从原始字符串中提取 JSON 内容：
     * 1. 优先匹配 ```json ... ``` 代码块
     * 2. 其次直接提取最外层的 { ... }
     * 3. 如果都匹配不到，原样返回，让父类决定是否报错
     */
    private String stripMarkdown(String source) {
        if (source == null) {
            return "";
        }
        // 尝试匹配 markdown 代码块
        Matcher codeMatcher = CODE_BLOCK_PATTERN.matcher(source);
        if (codeMatcher.find()) {
            return codeMatcher.group(1).trim();
        }
        // 尝试直接匹配 JSON 对象
        Matcher jsonMatcher = JSON_OBJECT_PATTERN.matcher(source);
        if (jsonMatcher.find()) {
            return jsonMatcher.group(1).trim();
        }
        return source.trim();
    }
}
