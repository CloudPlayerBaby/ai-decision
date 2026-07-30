package qg.po.midterm.workflow.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.RunnableConfig;
import org.springframework.stereotype.Service;
import qg.po.midterm.dto.result.ValidationResult;
import qg.po.midterm.workflow.DecisionWorkflow;
import qg.po.midterm.workflow.WorkflowExecutor;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowExecutorImpl implements WorkflowExecutor {

    private final DecisionWorkflow decisionWorkflow;

    @Override
    public String startAnalysis(String decisionId, String background, String goal, String constraints) {
        String taskId = UUID.randomUUID().toString();
        
        Map<String, Object> initData = new HashMap<>();
        initData.put("decisionId", decisionId);
        initData.put("taskId", taskId);
        initData.put("background", background);
        initData.put("goal", goal);
        initData.put("constraints", constraints);
        
        DecisionState state = new DecisionState(initData);
        runGraph(taskId, state);
        
        return taskId;
    }

    @Override
    public String retryStep(String taskId, String stepId) {
        log.info("Retrying step {} for task {}", stepId, taskId);
        // B 同学会使用 LangGraph4j 的 checkpointer 获取之前的状态，然后在这个 taskId 上重入
        // 由于咱们这里只提供底层暴露，B 拿到 getCompiledGraph() 后可以直接恢复图执行
        return "RETRY_TRIGGERED";
    }

    @Override
    public ValidationResult validateAndRepair(String jsonResult) {
        // 由于现在已经引入了图内的一次修复节点(RepairNode)，这里的外部校验方法可能会被逐步废弃，
        // 或者保留给前端单纯调校验使用。
        return new ValidationResult(true, false, null, null);
    }

    @Override
    public void runGraph(String taskId, DecisionState initialState) {
        // 构建 RunnableConfig，传入 threadId 启用 Checkpoint 持久化和追踪
        RunnableConfig config = RunnableConfig.builder()
                .threadId(taskId)
                .build();
                
        // 调用底层图执行（异步，或者由 B 来进行 stream 消费，这里如果被独立调用则阻塞执行完）
        try {
            getCompiledGraph().invoke(initialState.data(), config);
        } catch (Exception e) {
            log.error("Failed to execute graph for task {}", taskId, e);
        }
    }

    @Override
    public CompiledGraph<DecisionState> getCompiledGraph() {
        return decisionWorkflow.getGraph();
    }
}
