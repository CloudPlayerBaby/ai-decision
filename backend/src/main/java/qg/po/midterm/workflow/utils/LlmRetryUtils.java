package qg.po.midterm.workflow.utils;

import lombok.extern.slf4j.Slf4j;
import java.util.function.Supplier;

import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.common.enums.ErrorCode;

/**
 * 封装大模型调用的通用重试逻辑
 */
@Slf4j
public class LlmRetryUtils {

    /**
     * 带重试机制执行大模型调用
     *
     * @param maxRetries 最大尝试次数
     * @param action     需要执行的代码块（通常为大模型调用）
     * @param <T>        返回结果类型
     * @return 执行结果
     */
    public static <T> T withJsonRetry(int maxRetries, Supplier<T> action) {
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return action.get();
            } catch (Exception e) {
                log.warn("大模型返回非标准JSON格式，导致解析失败 (第 {}/{} 次尝试): {}", attempt, maxRetries, e.getMessage());
                if (attempt == maxRetries) {
                    throw new BusinessException(ErrorCode.AI_VALIDATION_FAILED, "大模型多次返回非标准JSON格式，导致工作流节点解析失败");
                }
            }
        }
        return null;
    }
}
