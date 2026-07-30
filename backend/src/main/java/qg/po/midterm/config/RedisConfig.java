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
 * Redis 统一配置类。
 *
 * <p>这个配置类的主要职责是把各种 Redis 操作工具注入到 Spring 容器中，供全局使用：
 * <ul>
 *   <li><b>RedissonClient</b>：第三方高级 Redis 客户端，LangGraph4j 底层依赖它。</li>
 *   <li><b>checkpointSaver</b>：专门用来把 AI 对话/图状态（Checkpoint）持久化保存到 Redis 的组件。</li>
 *   <li><b>redisTemplate / stringRedisTemplate</b>：Spring 官方提供的 Redis 操作工具，供你在写业务代码时存取数据。</li>
 * </ul>
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

    // ==================== 1. RedissonClient 配置 ====================

    /**
     * 创建并配置 Redisson 客户端。
     * Redisson 是一个功能强大的 Java Redis 客户端，很多第三方框架（如 LangGraph4j）都直接依赖它。
     *
     * @return RedissonClient 实例
     */
    @Bean(destroyMethod = "shutdown") // Spring 容器销毁时自动调用 shutdown() 关闭连接，防止内存泄漏
    public RedissonClient redissonClient() {
        Config config = new Config();

        // 拼接标准 Redis 连接地址格式，例如："redis://127.0.0.1:6379"
        String address = "redis://" + redisHost + ":" + redisPort;

        // 设置为单机 Redis 模式（如果你用的是集群，这里会有所不同）
        SingleServerConfig serverConfig = config.useSingleServer()
                .setAddress(address)
                .setDatabase(redisDatabase);

        // 如果配置文件里设置了密码，就把密码填进去
        if (redisPassword != null && !redisPassword.isBlank()) {
            serverConfig.setPassword(redisPassword);
        }

        // 根据配置创建 Redisson 客户端对象
        return Redisson.create(config);
    }

    // ==================== 2. LangGraph4j Checkpoint 持久化配置 ====================

    /**
     * 注册 LangGraph4j 的状态保存器（Checkpoint Saver）。
     *
     * 作用：AI 图工作流在执行过程中，会产生中间状态（Checkpoint）。
     * 这个 Bean 负责利用上面的 RedissonClient，把这些状态保存在 Redis 里。
     * 这样即使服务重启，AI 的对话上下文或工作流状态也不会丢失。
     */
    @Bean
    public BaseCheckpointSaver checkpointSaver(RedissonClient redissonClient) {
        return RedisSaver.builder()
                .redissonClient(redissonClient) // 传入上面配置好的 Redisson 客户端
                .build();
    }

    // ==================== 3. Spring Data Redis 模板配置 ====================

    /**
     * 配置通用 RedisTemplate（支持把 Java 对象自动转成 JSON 存入 Redis）。
     * 适用于业务代码中存放复杂的 Java 对象（如 User、Ticket 等）。
     *
     * @param connectionFactory Spring 自动注入的 Redis 连接工厂
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // 创建 Key 和 Value 的序列化工具（序列化就是把 Java 对象转成字符串/字节流存进 Redis）
        StringRedisSerializer stringSerializer = new StringRedisSerializer(); // Key 用纯文本格式存储，方便在 Redis 客户端里直接看懂
        RedisSerializer<Object> jsonSerializer = RedisSerializer.json();      // Value 用 JSON 格式存储，可直接序列化对象

        // 1. 设置 Key 的序列化方式（普通 Key 和 Hash Key 都用 String）
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);

        // 2. 设置 Value 的序列化方式（普通 Value 和 Hash Value 都用 JSON）
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        // 初始化模板的属性
        template.afterPropertiesSet();

        return template;
    }

    /**
     * 配置 StringRedisTemplate（专门处理 Key 和 Value 都是 String 的简单情况）。
     *
     * 作用：效率最高，适合直接存纯文本、数字、JSON 字符串等（如验证码、简单的 Ticket 凭证）。
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }
}