package qg.po.midterm.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.workflow.WorkflowExecutor;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.List;

/**
 * 将数据库任务异步交给 Workflow，避免创建任务接口被阻塞。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisWorkflowDispatcher {

    private final WorkflowExecutor workflowExecutor;

    @Async
    public void startFullAnalysis(String taskId, String decisionId, Decision decision) {
        try {
            workflowExecutor.startAnalysis(
                    taskId,
                    decisionId,
                    decision.getBackground(),
                    decision.getGoal(),
                    decision.getConstraints()
            );
        } catch (Exception exception) {
            // TODO Workflow 当前内部会吞掉异常；后续统一由任务事件监听器持久化 FAILED 状态。
            log.error("Failed to dispatch full analysis, taskId={}", taskId, exception);
        }
    }

    /**
     * 异步发起局部推演。
     *
     * <p>currentState 应由局部推演业务根据已保存的 AnalysisResult/画布构建。</p>
     */
    @Async
    public void startPartialAnalysis(
            String taskId,
            String decisionId,
            List<String> changedNodeIds,
            DecisionState currentState) {
        try {
            workflowExecutor.startPartialAnalysis(
                    taskId,
                    decisionId,
                    changedNodeIds,
                    currentState
            );
        } catch (Exception exception) {
            // TODO 后续由任务事件监听器回写局部推演失败信息。
            log.error(
                    "Failed to dispatch partial analysis, taskId={}, decisionId={}",
                    taskId,
                    decisionId,
                    exception
            );
        }
    }

    @Async
    public void retryStep(String taskId, String stepId) {
        try {
            // Workflow 会根据 taskId 的 checkpoint 找到失败步骤并恢复执行。
            workflowExecutor.retryStep(taskId);
        } catch (Exception exception) {
            // TODO 后续由任务事件监听器回写步骤失败信息。
            log.error("Failed to dispatch retry, taskId={}, stepId={}", taskId, stepId, exception);
        }
    }
}
