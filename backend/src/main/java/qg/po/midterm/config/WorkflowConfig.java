package qg.po.midterm.config;

import org.bsc.langgraph4j.checkpoint.BaseCheckpointSaver;
import org.bsc.langgraph4j.checkpoint.MemorySaver;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 工作流使用的公共组件。
 */
@Configuration
public class WorkflowConfig {

    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder.build();
    }

    //todo 由于现在还没redis配置，就先用内存来save检查点了，麻烦cjh同学后面写个RedisCheckpointSaver~
    @Bean
    public BaseCheckpointSaver checkpointSaver() {
        return new MemorySaver();
    }
}
