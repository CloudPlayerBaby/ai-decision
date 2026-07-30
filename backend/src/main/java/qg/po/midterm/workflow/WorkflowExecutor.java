package qg.po.midterm.workflow;

import qg.po.midterm.dto.ValidationResult;
import qg.po.midterm.workflow.state.DecisionState;

/**
 * AI 决策引擎接口 (提供给任务调度组 B 接入)
 */
public interface WorkflowExecutor {

    /**
     * 启动完整的 AI 推演图 (Workflow)
     *
     * @param decisionId  决策问题 ID
     * @param background  问题背景
     * @param goal        决策目标
     * @param constraints 约束条件
     * @return 初始化的推演任务状态摘要或执行结果
     */
    String startAnalysis(String decisionId, String background, String goal, String constraints);

    /**
     * 针对失败步骤触发重试
     *
     * @param taskId 异步推演的任务 ID
     * @param stepId 失败的步骤 ID
     * @return 步骤触发重试后的状态反馈
     */
    String retryStep(String taskId, String stepId);

    /**
     * 接收原始大模型输出，进行 JSON Schema 强校验
     * 如果失败，内部可触发“一次修复”逻辑
     *
     * @param jsonResult 大模型输出的 JSON 字符串
     * @return 结构化校验反馈（包含是否有效、是否修复、缺失字段等）
     */
    ValidationResult validateAndRepair(String jsonResult);
    
    /**
     * 底层直接运行推演节点图的方法 (给 B 同学深度集成使用)
     *
     * @param taskId 唯一任务ID，对应图的 thread_id，用于 Checkpoint 保存/恢复
     * @param initialState 初始状态，全自动时传入数据。为 null 则内部初始化。
     */
    void runGraph(String taskId, DecisionState initialState);
}
