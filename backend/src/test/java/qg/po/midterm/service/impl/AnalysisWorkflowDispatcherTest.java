package qg.po.midterm.service.impl;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.repository.TaskRuntimeRepository;
import qg.po.midterm.workflow.WorkflowExecutor;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.HashMap;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalysisWorkflowDispatcherTest {

    @Mock
    private WorkflowExecutor workflowExecutor;

    @Mock
    private TaskRuntimeRepository runtimeRepository;

    @InjectMocks
    private AnalysisWorkflowDispatcher dispatcher;

    @Test
    void partialAnalysisShouldCallWorkflowPublicMethod() {
        DecisionState state = new DecisionState(new HashMap<>());
        List<String> changedNodeIds = List.of("f_time");

        when(workflowExecutor.startPartialAnalysis(
                "d_20001",
                changedNodeIds,
                state
        )).thenReturn("workflow-task-1");

        dispatcher.startPartialAnalysis(
                "t_30001",
                "d_20001",
                changedNodeIds,
                state
        );

        verify(workflowExecutor).startPartialAnalysis(
                "d_20001",
                changedNodeIds,
                state
        );
        verify(runtimeRepository).saveWorkflowTaskId(
                "t_30001",
                "workflow-task-1"
        );
    }

    @Test
    void fullAnalysisShouldCallWorkflowPublicMethod() {
        Decision decision = new Decision();
        decision.setBackground("背景");
        decision.setGoal("目标");
        decision.setConstraints("约束");

        when(workflowExecutor.startAnalysis(
                "d_20001",
                "背景",
                "目标",
                "约束"
        )).thenReturn("workflow-task-2");

        dispatcher.startFullAnalysis(
                "t_30001",
                "d_20001",
                decision
        );

        verify(workflowExecutor).startAnalysis(
                "d_20001",
                "背景",
                "目标",
                "约束"
        );
        verify(runtimeRepository).saveWorkflowTaskId(
                "t_30001",
                "workflow-task-2"
        );
    }
}
