package qg.po.midterm.workflow.tools;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import qg.po.midterm.workflow.context.TaskContextHolder;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * 外部工具调用示例：汇率转换工具
 */
@Service
@lombok.RequiredArgsConstructor
public class ExchangeRateTool {

    private static final Logger log = LoggerFactory.getLogger(ExchangeRateTool.class);

    private final ApplicationEventPublisher eventPublisher;
    private final RestTemplate restTemplate = createRestTemplate();
    private final ObjectMapper objectMapper;
    
    private static RestTemplate createRestTemplate() {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(java.time.Duration.ofSeconds(5));
        factory.setReadTimeout(java.time.Duration.ofSeconds(10));
        return new RestTemplate(factory);
    }
    
    @org.springframework.beans.factory.annotation.Value("${exchange-rate.api-key}")
    private String apiKey;

    private String getApiUrl(String base) {
        return "https://v6.exchangerate-api.com/v6/" + apiKey + "/latest/" + base;
    }

    private void publishToolEvent(String status, String inputSummary, String outputSummary) {
        TaskContextHolder.TaskContext ctx = TaskContextHolder.getContext();
        if (ctx != null && eventPublisher != null) {
            try {
                String outputData = objectMapper.writeValueAsString(
                        Map.of("toolName", "exchangeRate", "inputSummary", inputSummary, "outputSummary", outputSummary != null ? outputSummary : "")
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
     * 工具名为 "exchangeRate"
     */
    @Tool(description = "一个提供实时汇率数据的工具。可用于在方案成本对比、跨国业务分析时将不同货币折算为统一基准货币。")
    public String exchangeRate(
            @ToolParam(description = "必须是标准的 ISO 4217 三位全大写字母货币代码作为基础货币，例如：USD, CNY, EUR") String baseCode,
            @ToolParam(description = "调用此汇率工具的目的，例如：折算服务器美元成本") String purpose) {

        log.info("🛠️ [Function Call] 大模型触发了汇率工具! 目的: {}, 基准货币: {}", purpose, baseCode);
        publishToolEvent("RUNNING", "查询汇率: " + baseCode + " (" + purpose + ")", null);

        if (baseCode == null || baseCode.trim().isEmpty() || baseCode.length() != 3) {
             publishToolEvent("SUCCEEDED", "查询汇率: " + baseCode, "参数错误");
             return "查询失败：基准货币代码不合法，必须使用 ISO 4217 三位货币代码，例如 USD、CNY。";
        }

        try {
            baseCode = baseCode.toUpperCase().trim();
            String apiUrl = getApiUrl(baseCode);
            Map<String, Object> response = restTemplate.getForObject(apiUrl, Map.class);
            
            if (response != null && "success".equals(response.get("result"))) {
                Object rates = response.get("conversion_rates");
                log.info("🛠️ [Function Call] 汇率查询成功");
                publishToolEvent("SUCCEEDED", "查询汇率: " + baseCode, "查询成功，已获取多国汇率");
                return "当前基准货币 " + baseCode + " 的实时汇率如下：\n" + rates;
            } else if (response != null && "error".equals(response.get("result"))) {
                String errorType = (String) response.get("error-type");
                log.error("🛠️ [Function Call] 汇率查询业务错误: {}", errorType);
                publishToolEvent("SUCCEEDED", "查询汇率: " + baseCode, "API报错: " + errorType);
                return "查询失败，API 返回错误类型: " + errorType;
            }
            
            return "查询失败：未知错误。";
            
        } catch (HttpClientErrorException e) {
            log.error("🛠️ [Function Call] 汇率 HTTP 请求错误: {}", e.getMessage());
            publishToolEvent("SUCCEEDED", "查询汇率: " + baseCode, "网络请求错误");
            return "请求失败：" + e.getMessage();
        } catch (Exception e) {
            log.error("🛠️ [Function Call] 汇率查询系统异常: {}", e.getMessage());
            publishToolEvent("SUCCEEDED", "查询汇率: " + baseCode, "系统异常");
            return "查询失败：" + e.getMessage();
        }
    }
}
