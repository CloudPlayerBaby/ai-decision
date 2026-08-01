package qg.po.midterm.workflow.tools;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Service;

import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.context.TaskContextHolder;
import tools.jackson.databind.ObjectMapper;

/**
 * 外部工具调用示例：计算器
 * 使用 Spring AI 2.0+ 的 @Tool 注解
 */
@Slf4j
@Service
@lombok.RequiredArgsConstructor
public class CalculatorTool {

    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    private void publishToolEvent(String status, String inputSummary, String outputSummary) {
        TaskContextHolder.TaskContext ctx = TaskContextHolder.getContext();
        if (ctx != null && eventPublisher != null) {
            try {
                String outputData = objectMapper.writeValueAsString(
                        Map.of("toolName", "calculator", "inputSummary", inputSummary, "outputSummary", outputSummary != null ? outputSummary : "")
                );
                eventPublisher.publishEvent(new NodeExecutionEvent(
                        this, "ToolCall", ctx.decisionId(), ctx.taskId(), status, null, outputData
                ));
            } catch (Exception e) {
                log.error("Failed to publish ToolCall event", e);
            }
        }
    }

    /**
     * 工具名为 "calculator" (默认取方法名)
     */
    @Tool(description = "一个支持基本数学运算的计算器，可用于计算总时间分配、分数加权或成本预算。")
    public String calculator(
            @ToolParam(description = "数学表达式，如 28/2") String expression,
            @ToolParam(description = "调用此计算器的目的") String purpose) {
        
        log.info("🛠️ [Function Call] 大模型触发了计算器工具! 目的: {}, 表达式: {}", purpose, expression);
        publishToolEvent("RUNNING", "计算: " + purpose + " (" + expression + ")", null);
        
        try {
            // 使用 Spring 内置的 SpEL 引擎计算数学表达式
            double result = SafeMathEvaluator.evaluate(expression);
            log.info("🛠️ [Function Call] 计算结果: {}", result);
            publishToolEvent("SUCCEEDED", "计算: " + purpose + " (" + expression + ")", "结果: " + result);
            return result + "\n[系统提示：你可以基于上述结果继续推理，或者根据需要再次调用 searchWeb/calculator 等工具。不要急于输出结论，直到你收集了充分的数据。]";
        } catch (Exception e) {
            log.error("🛠️ [Function Call] 计算出错: {}", e.getMessage());
            publishToolEvent("SUCCEEDED", "计算: " + purpose + " (" + expression + ")", "计算出错");
            return "计算失败：" + e.getMessage()
                    + "\n[系统提示：请只使用数字、小数、括号和 + - * / % 运算符。]";
        }
    }
}
