package qg.po.midterm.repository;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * SSE Ticket 和连接管理。
 *
 * <p>Ticket 使用 Redis 存储，支持多实例部署时跨节点共享。
 * SseEmitter 连接绑定在单机内存中（不可序列化），多实例时需在网关层做会话粘滞。</p>
 */
@Repository
public class TaskRuntimeRepository {

    private static final String TICKET_KEY_PREFIX = "sse_ticket:";
    private static final String EVENT_ID_KEY_PREFIX = "sse_event_id:";
    private static final String EVENT_SEQUENCE_KEY = "sse_event_sequence";

    private final StringRedisTemplate stringRedisTemplate;
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> connections = new ConcurrentHashMap<>();

    public TaskRuntimeRepository(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    /**
     * 创建有时效的 Ticket（存储在 Redis 中，到期自动清除）
     */
    public String createTicket(String taskId, long validSeconds) {
        String ticket = "sse_tk_" + UUID.randomUUID().toString().replace("-", "");
        String key = TICKET_KEY_PREFIX + ticket;
        stringRedisTemplate.opsForValue().set(key, taskId, Duration.ofSeconds(validSeconds));
        return ticket;
    }

    /**
     * 消费 Ticket（一次性使用，消费后立即删除）
     */
    public boolean consumeTicket(String taskId, String ticket) {
        String key = TICKET_KEY_PREFIX + ticket;
        String storedTaskId = stringRedisTemplate.opsForValue().getAndDelete(key);
        return taskId.equals(storedTaskId);
    }

    // ==================== SSE 连接（内存绑定，不可序列化） ====================

    public void addConnection(String taskId, SseEmitter emitter) {
        connections
                .computeIfAbsent(taskId, key -> new CopyOnWriteArrayList<>())
                .add(emitter);
    }

    public void removeConnection(String taskId, SseEmitter emitter) {
        List<SseEmitter> emitters = connections.get(taskId);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            connections.remove(taskId);
        }
    }

    /**
     * 返回副本，避免发送过程中连接列表变化
     */
    public List<SseEmitter> getConnections(String taskId) {
        List<SseEmitter> emitters = connections.get(taskId);
        return emitters == null ? List.of() : List.copyOf(emitters);
    }

    public Map<String, CopyOnWriteArrayList<SseEmitter>> getAllConnections() {
        return connections;
    }

    // ==================== Event ID ====================

    public String nextEventId(String taskId) {
        Long eventNumber = stringRedisTemplate
                .opsForValue()
                .increment(EVENT_SEQUENCE_KEY);
        String eventId = "evt_" + eventNumber;
        stringRedisTemplate.opsForValue().set(EVENT_ID_KEY_PREFIX + taskId, eventId);
        return eventId;
    }

    // 从redis里面读取
    public String getLastEventId(String taskId) {
        return stringRedisTemplate.opsForValue().get(EVENT_ID_KEY_PREFIX + taskId);
    }
}
