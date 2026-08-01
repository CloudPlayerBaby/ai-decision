package qg.po.midterm.workflow.agent;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import qg.po.midterm.dto.result.ReportContent;

import java.util.Map;

/**
 * 专门负责生成决策报告的 Agent。
 * 接收决策过程的所有 JSON 数据，转换并输出结构化的 JSON 报告。
 */
@Component
public class ReportAgent {

    private final ChatClient chatClient;

    @Value("classpath:prompts/report_generation.st")
    private Resource promptResource;

    public ReportAgent(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    /**
     * 将 JSON 结果和用户的选择，转化为精美的报告
     */
    public ReportContent generateReport(String analysisResultJson, String selectedOptionName) {
        Map<String, Object> params = Map.of(
                "analysisResult", analysisResultJson != null ? analysisResultJson : "{}",
                "selectedOptionName", selectedOptionName != null ? selectedOptionName : "无"
        );

        String promptText = new PromptTemplate(promptResource).create(params).getContents();

        return qg.po.midterm.workflow.utils.LlmRetryUtils.executeWithRepair(
                chatClient, promptText, null, ReportContent.class);
    }
}
