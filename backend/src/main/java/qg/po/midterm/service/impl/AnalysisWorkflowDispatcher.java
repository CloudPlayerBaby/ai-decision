package qg.po.midterm.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.repository.TaskRuntimeRepository;
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
    private final TaskRuntimeRepository runtimeRepository;

    // 异步调用整体推演
    @Async
    public void startFullAnalysis(String taskId, String decisionId, Decision decision) {
        try {
            // 调用提供的整轮推演接口
            String workflowTaskId = workflowExecutor.startAnalysis(
                    taskId,
                    decisionId,
                    decision.getBackground(),
                    decision.getGoal(),
                    decision.getConstraints()
            );
        } catch (Exception exception) {
            log.error("整体推演调用失败, taskId={}", taskId, exception);
        }
    }

    /**
     * 异步发起局部推演
     *
     * <p>currentState 应由局部推演业务根据已保存的 AnalysisResult/画布构建</p>
     */
    @Async
    public void startPartialAnalysis(
            String taskId,
            String decisionId,
            List<String> changedNodeIds,
            DecisionState currentState) {
        try {
            // 局部起点由 WorkflowExecutor 根据 changedNodeIds 判断。
            String workflowTaskId = workflowExecutor.startPartialAnalysis(
                    taskId,
                    decisionId,
                    changedNodeIds,
                    currentState
            );
        } catch (Exception exception) {
            log.error(
                    "Failed to dispatch partial analysis, taskId={}, decisionId={}",
                    taskId,
                    decisionId,
                    exception
            );
        }
    }

    // 异步发起失败步骤尝试
    @Async
    public void retryStep(String taskId, String stepId) {
        try {
            workflowExecutor.retryStep(taskId);
        } catch (Exception exception) {
            log.error("Failed to dispatch retry, taskId={}, stepId={}", taskId, stepId, exception);
        }
    }
}
