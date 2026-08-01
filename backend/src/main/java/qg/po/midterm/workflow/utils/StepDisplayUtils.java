package qg.po.midterm.workflow.utils;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class StepDisplayUtils {

    private final ObjectMapper objectMapper;

    public record StepDisplay(String summary, String content) {}

    public StepDisplay parseDisplay(String stepName, String status, String outputData, String errorMessage) {
        String summary = null;
        String content = null;

        if ("RUNNING".equals(status)) {
            summary = getRunningSummary(stepName);
            content = "思考中...";
        } else if ("WAITING".equals(status)) {
            summary = "等待" + getDisplayName(stepName);
            content = "即将开始...";
        } else if ("FAILED".equals(status)) {
            summary = getDisplayName(stepName) + "失败";
            content = errorMessage != null && !errorMessage.isBlank() ? errorMessage : "未知错误";
        } else if ("SUCCEEDED".equals(status)) {
            summary = getSucceededSummary(stepName);
            content = outputData;
            
            if (outputData != null && !outputData.isBlank()) {
                try {
                    JsonNode node = objectMapper.readTree(outputData);
                    if (node.has("summary") && !node.get("summary").isNull()) {
                        summary = node.get("summary").asText();
                    }
                    if (node.has("content") && !node.get("content").isNull()) {
                        content = node.get("content").asText();
                    }
                } catch (Exception e) {
                    // 解析失败时使用默认 summary 和原始 outputData
                }
            }
        } else {
            summary = getDisplayName(stepName);
        }

        return new StepDisplay(summary, content);
    }

    public static String getDisplayName(String name) {
        return switch (name) {
            case "UNDERSTAND" -> "理解问题";
            case "EXTRACT_FACTORS" -> "提取关键因素";
            case "TOOL_CALL" -> "调用工具";
            case "GENERATE_OPTIONS" -> "生成候选方案";
            case "COMPARE_OPTIONS" -> "比较候选方案";
            default -> name;
        };
    }

    private static String getRunningSummary(String stepName) {
        return switch (stepName) {
            case "UNDERSTAND" -> "正在理解问题上下文";
            case "EXTRACT_FACTORS" -> "正在分析关键因素";
            case "GENERATE_OPTIONS" -> "正在生成候选方案";
            case "COMPARE_OPTIONS" -> "正在进行风险与收益对比";
            default -> "正在执行";
        };
    }

    private static String getSucceededSummary(String stepName) {
        return switch (stepName) {
            case "UNDERSTAND" -> "问题理解完成";
            case "EXTRACT_FACTORS" -> "关键因素提取完成";
            case "GENERATE_OPTIONS" -> "候选方案生成完成";
            case "COMPARE_OPTIONS" -> "评估与对比完成";
            default -> "执行完成";
        };
    }
}
