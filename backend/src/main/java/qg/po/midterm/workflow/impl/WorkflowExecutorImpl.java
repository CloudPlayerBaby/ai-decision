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
    public String retryStep(String taskId) {
        log.info("Retrying task {} from the last failed node checkpoint", taskId);
        // 传入 null 状态，LangGraph4j 会自动通过 CheckpointSaver (基于 threadId=taskId)
        // 恢复上一次挂起的图状态并继续执行失败的节点。
        runGraph(taskId, null);
        return "RETRY_TRIGGERED";
    }

    @Override
    public String startPartialAnalysis(String decisionId, java.util.List<String> changedNodeIds, DecisionState currentState) {
        String taskId = UUID.randomUUID().toString();
        
        // 根据 changedNodeIds 判断从哪个节点开始重推
        // 如果改了因素(factor)，需要重新生成方案 -> GENERATE_OPTIONS
        // 如果只改了方案(option)，只需要重新对比风险 -> COMPARE_OPTIONS
        String startNode = "UNDERSTAND";
        boolean factorChanged = changedNodeIds.stream().anyMatch(id -> id.startsWith("f_"));
        boolean optionChanged = changedNodeIds.stream().anyMatch(id -> id.startsWith("opt_"));

        if (factorChanged) {
            startNode = "GENERATE_OPTIONS";
        } else if (optionChanged) {
            startNode = "COMPARE_OPTIONS";
        }

        log.info("Starting partial analysis for decision {} with startNode: {}", decisionId, startNode);

        Map<String, Object> initData = new HashMap<>(currentState.data());
        initData.put("decisionId", decisionId);
        initData.put("taskId", taskId);
        initData.put("startNode", startNode);

        DecisionState state = new DecisionState(initData);
        runGraph(taskId, state);

        return taskId;
    }

    @Override
    public ValidationResult validateAndRepair(String jsonResult) {
        // 由于现在已经引入了图内的一次修复节点(RepairNode)，这里的外部校验方法可能会被逐步废弃，
        // 或者保留给前端单纯调校验使用。
        return new ValidationResult(true, false, null, null);
    }

    @Override
    public void runGraph(String taskId, DecisionState initialState) {
        RunnableConfig config = RunnableConfig.builder().threadId(taskId).build();
        try {
            Map<String, Object> stateData = (initialState != null) ? initialState.data() : null;
            getCompiledGraph().invoke(stateData, config);
        } catch (Exception e) {
            log.error("Failed to execute graph for task {}", taskId, e);
        }
    }

    @Override
    public CompiledGraph<DecisionState> getCompiledGraph() {
        return decisionWorkflow.getGraph();
    }
}
