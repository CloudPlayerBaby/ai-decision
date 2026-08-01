package qg.po.midterm.workflow.tools;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.time.Duration;

import java.util.List;
import java.util.Map;

import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.context.TaskContextHolder;
import tools.jackson.databind.ObjectMapper;

/**
 * Tavily Search API 工具
 */
@Slf4j
@Service
@lombok.RequiredArgsConstructor
public class TavilySearchTool {

    @Value("${tavily.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate = createRestTemplate();
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(20));
        return new RestTemplate(factory);
    }

    private void publishToolEvent(String status, String inputSummary, String outputSummary) {
        TaskContextHolder.TaskContext ctx = TaskContextHolder.getContext();
        if (ctx != null && eventPublisher != null) {
            try {
                String outputData = objectMapper.writeValueAsString(
                        Map.of("toolName", "TavilySearch", "inputSummary", inputSummary, "outputSummary", outputSummary != null ? outputSummary : "")
                );
                eventPublisher.publishEvent(new NodeExecutionEvent(
                        this, "ToolCall", ctx.decisionId(), ctx.taskId(), status, null, outputData
                ));
            } catch (Exception e) {
                log.error("Failed to publish ToolCall event", e);
            }
        }
    }

    @Tool(description = "一个强大的互联网搜索引擎。当你的内部知识库缺乏某些最新资讯、需要实时客观数据（如价格、天气、最新政策、市场行情、口碑评价等），或者需要核实某些外部事实以辅助决策时，请调用此工具。")
    public String searchWeb(
            @ToolParam(description = "搜索关键字，请提取用户决策中最核心的实体和疑问。例如：'2024年三亚旅游淡季时间及机票价格' 或 '特斯拉Model 3与比亚迪海豹最新优缺点对比'") String query) {

        log.debug("🛠️ [Function Call] 大模型触发了 Web 搜索! 关键词: {}", query);
        publishToolEvent("RUNNING", "正在搜索网络: " + query, null);

        if (apiKey == null || apiKey.isBlank() || apiKey.startsWith("tvly-your_tavily_api_key_here")) {
            log.debug("🛠️ [Function Call] 未配置有效的 TAVILY_API_KEY，跳过搜索");
            publishToolEvent("SUCCEEDED", "搜索: " + query, "未配置API KEY，跳过搜索");
            return "网络搜索已被禁用（未配置有效 API Key），请根据你现有的知识库回答。";
        }

        int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                // 构造请求体
                Map<String, Object> body = Map.of(
                        "api_key", apiKey,
                        "query", query,
                        "search_depth", "basic",
                        "include_answer", false,
                        "max_results", 3
                );

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

                // 发起调用
                ResponseEntity<Map> response = restTemplate.postForEntity(
                        "https://api.tavily.com/search",
                        request,
                        Map.class
                );

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    List<Map<String, Object>> results = (List<Map<String, Object>>) response.getBody().get("results");
                    if (results == null || results.isEmpty()) {
                        publishToolEvent("SUCCEEDED", "搜索: " + query, "搜索完成，但没有找到相关信息");
                        return "搜索完成，但没有找到相关信息。";
                    }

                    // 提取摘要
                    StringBuilder summary = new StringBuilder("网络搜索结果摘要：\n");
                    for (Map<String, Object> res : results) {
                        summary.append("- 标题: ").append(res.get("title")).append("\n")
                                .append("  内容: ").append(res.get("content")).append("\n\n");
                    }
                    
                    String finalSummary = summary.toString();
                    log.debug("🛠️ [Function Call] 搜索成功，获取了 {} 条结果。具体摘要内容如下：\n{}", results.size(), finalSummary);
                    publishToolEvent("SUCCEEDED", "搜索: " + query, "成功获取 " + results.size() + " 条搜索结果");
                    return finalSummary + "\n\n[系统提示：你可以基于上述结果继续推理，或者根据需要再次调用 searchWeb/calculator 等工具。不要急于输出结论，直到你收集了充分的数据。]";
                }

                publishToolEvent("SUCCEEDED", "搜索: " + query, "搜索失败，接口未返回有效数据");
                return "搜索失败，接口未返回有效数据。\n[系统提示：请尝试换一个更宽泛或更准确的 query 重新搜索。]";

            } catch (RestClientException e) {
                log.debug("🛠️ [Function Call] 搜索请求出现网络异常 (第 {}/{} 次尝试): {}", attempt, maxRetries, e.getMessage());
                if (attempt == maxRetries) {
                    publishToolEvent("SUCCEEDED", "搜索: " + query, "网络受限，搜索失败");
                    return "网络受限，多次重试均无法获取外部搜索结果，请根据你自身知识库回答。";
                }
                try {
                    Thread.sleep(2000); // 间隔 2 秒重试
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    publishToolEvent("SUCCEEDED", "搜索: " + query, "搜索组件线程被中断");
                    return "搜索组件线程被中断，请根据自身知识库回答。";
                }
            } catch (Exception e) {
                log.debug("🛠️ [Function Call] 搜索未知错误: {}", e.getMessage());
                publishToolEvent("SUCCEEDED", "搜索: " + query, "搜索发生未知错误");
                return "搜索组件发生未知错误，请根据自身知识库回答。";
            }
        }
        
        publishToolEvent("SUCCEEDED", "搜索: " + query, "网络受限，无法获取外部搜索结果");
        return "网络受限，无法获取外部搜索结果，请根据你自身知识库回答。";
    }
}
