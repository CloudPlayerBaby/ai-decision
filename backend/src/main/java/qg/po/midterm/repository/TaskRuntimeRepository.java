package qg.po.midterm.repository;

import org.springframework.stereotype.Repository;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 保存 SSE Ticket 和当前在线连接。
 *
 * <p>这些都是短期运行数据，不属于业务结果，所以暂时放在内存中。
 * 多实例部署时应改用 Redis。</p>
 */
@Repository
public class TaskRuntimeRepository {

    private final Map<String, TicketData> tickets = new ConcurrentHashMap<>();
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> connections =
            new ConcurrentHashMap<>();
    private final Map<String, String> lastEventIds = new ConcurrentHashMap<>();
    private final AtomicLong eventNumber = new AtomicLong();

    /**
     * 创建 60 秒有效的 Ticket。
     */
    public String createTicket(String taskId, long validSeconds) {
        String ticket = "sse_tk_" + UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plusSeconds(validSeconds);
        tickets.put(ticket, new TicketData(taskId, expiresAt));
        return ticket;
    }

    /**
     * 消费 Ticket。
     *
     * remove 保证同一个 Ticket 只能使用一次。
     */
    public boolean consumeTicket(String taskId, String ticket) {
        TicketData ticketData = tickets.remove(ticket);
        if (ticketData == null) {
            return false;
        }
        if (!ticketData.taskId().equals(taskId)) {
            return false;
        }
        return ticketData.expiresAt().isAfter(Instant.now());
    }

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
     * 返回副本，避免发送过程中连接列表变化。
     */
    public List<SseEmitter> getConnections(String taskId) {
        List<SseEmitter> emitters = connections.get(taskId);
        return emitters == null ? List.of() : List.copyOf(emitters);
    }

    public Map<String, CopyOnWriteArrayList<SseEmitter>> getAllConnections() {
        return connections;
    }

    public String nextEventId(String taskId) {
        String eventId = "evt_" + eventNumber.incrementAndGet();
        lastEventIds.put(taskId, eventId);
        return eventId;
    }

    public String getLastEventId(String taskId) {
        return lastEventIds.get(taskId);
    }

    private record TicketData(String taskId, Instant expiresAt) {
    }
}
