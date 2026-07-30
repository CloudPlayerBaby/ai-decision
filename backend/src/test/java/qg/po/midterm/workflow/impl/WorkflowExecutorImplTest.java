package qg.po.midterm.workflow.impl;

import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.RunnableConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import qg.po.midterm.workflow.DecisionWorkflow;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WorkflowExecutorImplTest {

    @Mock
    private DecisionWorkflow decisionWorkflow;

    @Mock
    private CompiledGraph<DecisionState> compiledGraph;

    @InjectMocks
    private WorkflowExecutorImpl workflowExecutor;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(decisionWorkflow.getGraph()).thenReturn(compiledGraph);
    }

    /**
     * 测试 10.3 接口约定：当用户修改了 factor 时，引擎应指定 startNode = GENERATE_OPTIONS
     */
    @Test
    void testStartPartialAnalysis_WhenFactorChanged_ShouldStartFromGenerateOptions() throws Exception {
        // Arrange
        String decisionId = "d_12345";
        List<String> changedNodeIds = Arrays.asList("f_time"); // 对应 PRD: factor 改变

        Map<String, Object> baseData = new HashMap<>();
        baseData.put("understanding", "测试理解内容");
        DecisionState currentState = new DecisionState(baseData);

        // Act
        String taskId = workflowExecutor.startPartialAnalysis(decisionId, changedNodeIds, currentState);

        // Assert
        assertNotNull(taskId);
        
        // 捕获注入到图执行的初始状态 (Map)
        ArgumentCaptor<Map<String, Object>> stateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(compiledGraph, times(1)).invoke(stateCaptor.capture(), any(RunnableConfig.class));

        Map<String, Object> injectedState = stateCaptor.getValue();
        assertEquals(decisionId, injectedState.get("decisionId"));
        assertEquals(taskId, injectedState.get("taskId"));
        assertEquals("GENERATE_OPTIONS", injectedState.get("startNode")); // 断言核心逻辑
    }

    /**
     * 测试 10.3 接口约定：当用户仅修改了 option 时，引擎应指定 startNode = COMPARE_OPTIONS
     */
    @Test
    void testStartPartialAnalysis_WhenOptionChanged_ShouldStartFromCompareOptions() throws Exception {
        // Arrange
        String decisionId = "d_12345";
        List<String> changedNodeIds = Arrays.asList("opt_redis"); // 对应 PRD: option 改变

        DecisionState currentState = new DecisionState(new HashMap<>());

        // Act
        workflowExecutor.startPartialAnalysis(decisionId, changedNodeIds, currentState);

        // Assert
        ArgumentCaptor<Map<String, Object>> stateCaptor = ArgumentCaptor.forClass(Map.class);
        verify(compiledGraph, times(1)).invoke(stateCaptor.capture(), any(RunnableConfig.class));

        Map<String, Object> injectedState = stateCaptor.getValue();
        assertEquals("COMPARE_OPTIONS", injectedState.get("startNode"));
    }

    /**
     * 测试 7.3 接口约定：重试失败的步骤 (调用 invoke(null) 触发 checkpoint 恢复)
     */
    @Test
    void testRetryStep_ShouldInvokeWithNullState() throws Exception {
        // Arrange
        String taskId = "t_error_task";

        // Act
        String result = workflowExecutor.retryStep(taskId);

        // Assert
        assertEquals("RETRY_TRIGGERED", result);
        
        ArgumentCaptor<RunnableConfig> configCaptor = ArgumentCaptor.forClass(RunnableConfig.class);
        // 断言传入了 null 状态，依靠 config 里的 threadId 去恢复
        verify(compiledGraph, times(1)).invoke((Map<String, Object>) isNull(), configCaptor.capture());
        assertEquals(taskId, configCaptor.getValue().threadId().orElse(null));
    }
}
