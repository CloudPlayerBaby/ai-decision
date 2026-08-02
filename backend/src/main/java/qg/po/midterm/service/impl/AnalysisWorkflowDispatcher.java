package qg.po.midterm.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.repository.TaskRuntimeRepository;
import qg.po.midterm.workflow.WorkflowExecutor;
import qg.po.midterm.workflow.event.WorkflowFailedEvent;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.List;

import static qg.po.midterm.config.AsyncConfig.WORKFLOW_TASK_EXECUTOR;

/**
 * 将数据库任务异步交给 Workflow，避免创建任务接口被阻塞。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisWorkflowDispatcher {

    private final WorkflowExecutor workflowExecutor;
    private final TaskRuntimeRepository runtimeRepository;
    private final ApplicationEventPublisher eventPublisher;

    // 异步调用整体推演
    @Async(WORKFLOW_TASK_EXECUTOR)
    public void startFullAnalysis(String taskId, String decisionId, Decision decision) {
        try {
            // 调用提供的整轮推演接口
            String workflowTaskId = workflowExecutor.startAnalysis(
                    taskId,
                    decisionId,
                    decision.getTitle(),
                    decision.getBackground(),
                    decision.getGoal(),
                    decision.getConstraints()
            );
        } catch (Exception exception) {
            log.error("整体推演调用失败, taskId={}", taskId, exception);
            publishWorkflowFailed(taskId, exception);
        }
    }

    /**
     * 异步发起局部推演
     *
     * <p>currentState 应由局部推演业务根据已保存的 AnalysisResult/画布构建</p>
     */
    @Async(WORKFLOW_TASK_EXECUTOR)
    public void startPartialAnalysis(
            String taskId,
            String decisionId,
            String startNode,
            DecisionState currentState) {
        try {
            // 局部起点已由服务层按画布节点业务类型计算完成。
            String workflowTaskId = workflowExecutor.startPartialAnalysis(
                    taskId,
                    decisionId,
                    startNode,
                    currentState
            );
        } catch (Exception exception) {
            log.error(
                    "Failed to dispatch partial analysis, taskId={}, decisionId={}",
                    taskId,
                    decisionId,
                    exception
            );
            publishWorkflowFailed(taskId, exception);
        }
    }

    // 异步发起失败步骤尝试
    @Async(WORKFLOW_TASK_EXECUTOR)
    public void retryStep(String taskId, String stepId, String startNode, DecisionState currentState) {
        try {
            workflowExecutor.retryStep(taskId, startNode, currentState);
        } catch (Exception exception) {
            log.error("发起异步推演失败, taskId={}, stepId={}", taskId, stepId, exception);
            publishWorkflowFailed(taskId, exception);
        }
    }

    private void publishWorkflowFailed(String taskId, Exception exception) {
        eventPublisher.publishEvent(
                new WorkflowFailedEvent(this, taskId, exception)
        );
    }
}
