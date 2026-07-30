package qg.po.midterm.config;

import org.bsc.langgraph4j.checkpoint.BaseCheckpointSaver;
import org.bsc.langgraph4j.checkpoint.RedisSaver;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.redisson.config.SingleServerConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis 配置。
 *
 * <p>这里只创建 Workflow 保存运行状态需要的 RedissonClient 和 RedisSaver。
 * 业务代码使用的 StringRedisTemplate 会由 Spring Boot 自动创建，
 * 不需要在这里重复配置。
 */
@Configuration // 标记这是一个 Spring 配置类，启动时会自动扫描并执行里面的 @Bean 方法
public class RedisConfig {

    // -------------------------------------------------------------
    // 1. 从配置文件 (application.yml / application.properties) 中读取 Redis 连接参数
    //    冒号后面的值（如 localhost、6379）是默认值，防止配置文件没写时报错。
    // -------------------------------------------------------------

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost; // Redis 服务端 IP/域名

    @Value("${spring.data.redis.port:6379}")
    private int redisPort; // Redis 端口号

    @Value("${spring.data.redis.password:}")
    private String redisPassword; // Redis 密码（如果有）

    @Value("${spring.data.redis.database:0}")
    private int redisDatabase; // 使用的 Redis 数据库编号（默认 0 号库）

    /**
     * 创建 Workflow 使用的 Redis 客户端。
     */
    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient() {
        Config config = new Config();

        // 当前项目使用单机 Redis
        String address = "redis://" + redisHost + ":" + redisPort;

        // 设置为单机 Redis 模式（如果你用的是集群，这里会有所不同）
        SingleServerConfig serverConfig = config.useSingleServer()
                .setAddress(address)
                .setDatabase(redisDatabase);

        // 密码要设置到本次单机连接上。
        if (redisPassword != null && !redisPassword.isBlank()) {
            serverConfig.setPassword(redisPassword);
        }

        return Redisson.create(config);
    }

    /**
     * 把 Workflow 的运行状态保存到 Redis
     */
    @Bean
    public BaseCheckpointSaver checkpointSaver(RedissonClient redissonClient) {
        return RedisSaver.builder()
                .redissonClient(redissonClient) // 传入上面配置好的 Redisson 客户端
                .build();
    }
}
