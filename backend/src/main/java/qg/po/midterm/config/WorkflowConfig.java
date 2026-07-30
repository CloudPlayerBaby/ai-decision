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

    /**
     * 内存状态保存器（备用方案）。
     *
     * 注意：RedisConfig 中已经通过 RedissonClient 注册了 RedisSaver，
     * 当 Redis 可用时，Spring 容器中会有多个 BaseCheckpointSaver 候选。
     * 如果本 Bean 导致冲突，需要加 @Primary 或 @ConditionalOnMissingBean 来消除歧义。
     * 长期目标：全面切换到 RedisSaver，废弃本 Bean。
     */
    @Bean
    public BaseCheckpointSaver checkpointSaver() {
        return new MemorySaver();
    }
}
