package qg.po.midterm.workflow.tools;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Service;

/**
 * 外部工具调用示例：计算器
 * 使用 Spring AI 2.0+ 的 @Tool 注解
 */
@Slf4j
@Service
public class CalculatorTool {

    private final ExpressionParser parser = new SpelExpressionParser();

    /**
     * 工具名为 "calculator" (默认取方法名)
     */
    @Tool(description = "一个支持基本数学运算的计算器，可用于计算总时间分配、分数加权或成本预算。")
    public double calculator(
            @ToolParam(description = "数学表达式，如 28/2") String expression,
            @ToolParam(description = "调用此计算器的目的") String purpose) {
        
        log.info("🛠️ [Function Call] 大模型触发了计算器工具! 目的: {}, 表达式: {}", purpose, expression);
        try {
            // 使用 Spring 内置的 SpEL 引擎计算数学表达式
            Double result = parser.parseExpression(expression).getValue(Double.class);
            if (result == null) {
                result = 0.0;
            }
            log.info("🛠️ [Function Call] 计算结果: {}", result);
            return result;
        } catch (Exception e) {
            log.error("🛠️ [Function Call] 计算出错: {}", e.getMessage());
            // 如果解析失败（比如传入了奇怪的字符串），返回 0 以降级处理
            return 0.0;
        }
    }
}
