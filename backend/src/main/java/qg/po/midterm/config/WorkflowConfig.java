package qg.po.midterm.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import qg.po.midterm.workflow.prompt.PromptPolicy;

/**
 * 工作流使用的公共组件。
 */
@Configuration
public class WorkflowConfig {

    // 自动注入一个 ChatClient
    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder.defaultSystem(PromptPolicy.SYSTEM_PROMPT).build();
    }
}
