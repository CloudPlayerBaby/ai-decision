package qg.po.midterm.workflow;

import org.bsc.langgraph4j.CompiledGraph;
import qg.po.midterm.dto.result.ValidationResult;
import qg.po.midterm.workflow.state.DecisionState;

/**
 * AI 决策引擎核心服务接口 (A组提供)
 * 
 * 专门交付给：
 * - B 同学 (任务调度与通信组)：用于挂载异步任务、拦截状态并触发 SSE 事件推送。
 * - C 同学 (业务组)：用于在业务层拼接参数、触发局部重推、获取分析结果。
 * 
 * 遵守契约：所有大模型底层交互（如 API Key 轮询、温度调节、上下文切片、Token 截断）对外部绝对透明。
 */
public interface WorkflowExecutor {

    /**
     * 【给 B 同学 / C 同学使用】：全新发起一次全量决策推演任务
     * <p>
     * 对应 PRD 7.1 节。这是最标准的图引擎执行入口。
     * 引擎接收最原始的业务请求参数，会经历完整的节点：背景分析 -> 因素拆解 -> 生成方案 -> 方案对比 -> 结果输出。
     * 
     * ⚠️ 注意事项：
     * 1. 此方法内部是**异步执行或阻塞执行**（取决于实现方式），建议 B 同学在调用时，把它包在 `CompletableFuture` 或 Spring Async 中。
     * 2. 执行过程中，引擎会自动通过 `ApplicationEventPublisher` 抛出 `NodeExecutionEvent`。B 同学需要配置 `@EventListener` 全局监听该事件，将其转为 SSE 推给前端。
     *
     * @param decisionId  所属的决策问题唯一标识 (对应 PRD 4.1，用于持久化绑定)
     * @param background  用户填写的补充背景（可空，最大 2000 字，引擎内部不校验超长，上游 C 组负责前置截断）
     * @param goal        用户填写的核心决策目标（必填，引擎分析的锚点）
     * @param constraints 用户填写的约束条件（可空，例如“时间不超过2天”）
     * @return 引擎自动生成的全新推演 taskId。B 同学需要把这个 taskId 落库，用来应对前端断线重连。
     */
    String startAnalysis(String decisionId, String background, String goal, String constraints);

    /**
     * 【给 B 同学使用】：死机读档复活（原点重试失败步骤）
     * <p>
     * 对应 PRD 7.3 节。当引擎执行某个节点由于网络闪断、AI 校验彻底挂掉（状态变成 FAILED）后，
     * 前端用户点击红色的“重试”按钮时调用。
     * 
     * 🎯 核心原理：
     * 这里不需要传任何业务参数！引擎底层依赖了 LangGraph4j 的 `BaseCheckpointSaver`。
     * 引擎通过传入的 `taskId`，自动去快照库中捞出上一次挂掉之前的进度状态，原地重启中断的节点。
     *
     * @param taskId 之前挂掉的那个推演任务 ID（对应底层的 threadId）
     * @return 返回 "RETRY_TRIGGERED" 代表成功丢入队列；如果该 taskId 的快照不存在，可能会抛出异常。
     */
    String retryStep(String taskId);

    /**
     * 【给 C 同学使用】：基于用户修改画布触发的“局部重推”
     * <p>
     * 对应 PRD 10.3 节。用户在前端微调了某个因素权重或某个方案描述，点击【重新评估】。
     * 
     * 🧠 智能路由机制：
     * A 组引擎会根据你传过来的 `changedNodeIds`（被改掉的组件标识）：
     * - 改了因素 (f_xxx)：自动将起点算为 `GENERATE_OPTIONS`
     * - 改了方案 (opt_xxx)：自动将起点算为 `COMPARE_OPTIONS`
     * 随后图启动时，引擎会空间跳跃，绕过前面又贵又慢的节点，直接基于旧数据继续往下算。
     * 
     * @param decisionId     当前决策问题 ID
     * @param changedNodeIds 前端提交上来的，被修改的节点 ID 集合（比如 ["f_time", "opt_redis"]）
     * @param currentState   修改后、且包含历史推演满血数据的上下文大满贯对象 (由 C 组从数据库组装并传入)
     * @return 返回全新生成的 taskId（注意：局部重推是生成新的草案，所以是新任务）
     */
    String startPartialAnalysis(String decisionId, java.util.List<String> changedNodeIds, DecisionState currentState);

    /**
     * 【给 A 组内部使用，未来可对外暴露】：JSON 强校验与修复钩子
     * <p>
     * 对应 PRD 12 节。验证 AI 吐出的非结构化文本是否符合 DTO，如果缺胳膊少腿，自动重试。
     * 
     * @param jsonResult 刚出炉的大模型 JSON 字符串
     * @return 结构化校验结果，若依然失败则 B 组需将任务标记为 FAILED。
     */
    ValidationResult validateAndRepair(String jsonResult);

    /**
     * 【高度危险：给 B 同学深度集成使用】底层图调度器
     * <p>
     * 这是 A 组内部使用的底层驱动引擎。B 同学**绝不要**自己手动拼装 `DecisionState` 去调用这个接口！
     * 除非在写单元测试，或者未来需要自己重写任务队列包裹机制。
     * 业务中请统一使用 `startAnalysis` 和 `startPartialAnalysis` 两个上层安全封装。
     *
     * @param taskId 唯一任务ID，对应图的 thread_id，用于 Checkpoint 保存/恢复
     * @param initialState 初始状态，全自动时传入数据。为 null 则内部触发读取快照机制。
     */
    void runGraph(String taskId, DecisionState initialState);

    /**
     * 【暴露给 B 同学使用】：获取编译后的 LangGraph4j 核心图实例。
     * <p>
     * 💡 进阶用法：如果 B 同学觉得我们通过抛 `NodeExecutionEvent` 的方式不够灵活，
     * 可以直接调用此方法拿到纯净的 Graph 对象。
     * 然后使用 `graph.stream(...)` 拿到原生的 `AsyncGenerator`，自己去跑循环拿到每一个节点的 Output，实现更细粒度的控制。
     */
    CompiledGraph<DecisionState> getCompiledGraph();
}
