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
     * 【给 B 同学使用】：从指定业务节点重试失败任务。
     * <p>
     * 重试状态由业务层根据数据库中已完成步骤的输出重建，不依赖工作流快照。
     *
     * @param taskId 当前推演任务 ID
     * @param startNode 重试起始业务节点
     * @param currentState 从持久化业务数据重建的当前状态
     * @return 返回 "RETRY_TRIGGERED" 代表成功触发重试
     */
    String retryStep(String taskId, String startNode, DecisionState currentState);

    /**
     * 【给 B 同学 / C 同学使用】：全新发起一次全量决策推演任务
     * @param taskId      外部传入的唯一任务ID
     * @param decisionId  所属的决策问题唯一标识
     * @param title       用户填写的决策主题
     * @param background  用户填写的补充背景
     * @param goal        用户填写的核心决策目标
     * @param constraints 用户填写的约束条件
     * @return 引擎执行的推演 taskId
     */
    String startAnalysis(String taskId, String decisionId, String title, String background, String goal, String constraints);

    /**
     * 【给 C 同学使用】：基于用户修改画布触发的“局部重推”
     * @param taskId         外部传入的新任务ID
     * @param decisionId     当前决策问题 ID
     * @param startNode 后端根据节点业务类型计算出的实际重推起点
     * @param currentState   修改后包含历史数据的当前状态
     * @return 引擎执行的推演 taskId
     */
    String startPartialAnalysis(String taskId, String decisionId, String startNode, DecisionState currentState);

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
     * @param taskId 唯一任务 ID，用于业务事件关联
     * @param initialState 本次执行所需的完整初始状态
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
