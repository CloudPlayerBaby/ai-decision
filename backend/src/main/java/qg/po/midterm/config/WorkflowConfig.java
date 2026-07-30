package qg.po.midterm.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 工作流使用的公共组件。
 */
@Configuration
public class WorkflowConfig {

    /**
     * Spring AI 默认提供 ChatClient.Builder，
     * 这里把它构建成各个工作流节点直接使用的 ChatClient。
     */
    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder.build();
    }
}
