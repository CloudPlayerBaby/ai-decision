package qg.po.midterm.workflow.tools;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Service;

import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.context.TaskContextHolder;

/**
 * 外部工具调用示例：计算器
 * 使用 Spring AI 2.0+ 的 @Tool 注解
 */
@Slf4j
@Service
@lombok.RequiredArgsConstructor
public class CalculatorTool {

    private final ExpressionParser parser = new SpelExpressionParser();
    private final ApplicationEventPublisher eventPublisher;

    private void publishToolEvent(String status, String inputSummary, String outputSummary) {
        TaskContextHolder.TaskContext ctx = TaskContextHolder.getContext();
        if (ctx != null && eventPublisher != null) {
            try {
                String outputData = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(
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
            Double result = parser.parseExpression(expression).getValue(Double.class);
            if (result == null) {
                result = 0.0;
            }
            log.info("🛠️ [Function Call] 计算结果: {}", result);
            publishToolEvent("SUCCEEDED", "计算: " + purpose + " (" + expression + ")", "结果: " + result);
            return result + "\n[系统提示：你可以基于上述结果继续推理，或者根据需要再次调用 searchWeb/calculator 等工具。不要急于输出结论，直到你收集了充分的数据。]";
        } catch (Exception e) {
            log.error("🛠️ [Function Call] 计算出错: {}", e.getMessage());
            publishToolEvent("SUCCEEDED", "计算: " + purpose + " (" + expression + ")", "计算出错");
            // 如果解析失败（比如传入了奇怪的字符串），返回 0 以降级处理
            return "0.0\n[系统提示：计算出错。请检查表达式格式是否正确，并尝试重新调用 calculator 工具。]";
        }
    }
}
