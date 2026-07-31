package qg.po.midterm.workflow.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.RunnableConfig;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.ValidationResult;
import qg.po.midterm.workflow.AnalysisResultRepairer;
import qg.po.midterm.workflow.DecisionWorkflow;
import qg.po.midterm.workflow.WorkflowExecutor;
import qg.po.midterm.workflow.event.WorkflowCompletedEvent;
import qg.po.midterm.workflow.event.WorkflowFailedEvent;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.utils.AnalysisResultValidator;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowExecutorImpl implements WorkflowExecutor {

    private final DecisionWorkflow decisionWorkflow;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final AnalysisResultRepairer resultRepairer;

    public String startAnalysis(
            String taskId,
            String decisionId,
            String title,
            String background,
            String goal,
            String constraints) {
        Map<String, Object> initData = new HashMap<>();
        initData.put("decisionId", decisionId);
        initData.put("taskId", taskId);
        initData.put("title", title);
        initData.put("background", background);
        initData.put("goal", goal);
        initData.put("constraints", constraints);

        DecisionState state = new DecisionState(initData);
        runGraph(taskId, state);

        return taskId;
    }

    @Override
    public String retryStep(String taskId, String startNode, DecisionState currentState) {
        log.info("Retrying task {} from business node {}", taskId, startNode);
        Map<String, Object> initData = new HashMap<>(currentState.data());
        initData.put("taskId", taskId);
        initData.put("startNode", startNode);
        runGraph(taskId, new DecisionState(initData), taskId + ":retry:" + UUID.randomUUID());
        return "RETRY_TRIGGERED";
    }

    public String startPartialAnalysis(
            String taskId,
            String decisionId,
            String startNode,
            DecisionState currentState) {
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
        // 对应 PRD 12 节：先解析为 JSON，再做强校验；不合格则带原 JSON 交给 AI 修复一次后二次校验。
        AnalysisResultDto dto;
        try {
            dto = objectMapper.readValue(jsonResult, AnalysisResultDto.class);
        } catch (Exception e) {
            log.error("AI 结果 JSON 解析失败", e);
            return new ValidationResult(false, false, List.of("result (JSON 解析失败)"), List.of(e.getMessage()));
        }

        List<String> missingFields = AnalysisResultValidator.validate(dto);
        if (missingFields.isEmpty()) {
            return new ValidationResult(true, false, List.of(), null);
        }

        try {
            AnalysisResultDto repaired = resultRepairer.repair(
                    "校验失败，以下字段缺失或非法:\n- " + String.join("\n- ", missingFields),
                    dto
            );
            List<String> repairedMissing = AnalysisResultValidator.validate(repaired);
            return new ValidationResult(repairedMissing.isEmpty(), true, repairedMissing, null);
        } catch (Exception e) {
            log.error("AI 修复调用失败", e);
            return new ValidationResult(false, true, missingFields, List.of("AI 修复调用失败: " + e.getMessage()));
        }
    }

    @Override
    public void runGraph(String taskId, DecisionState initialState) {
        runGraph(taskId, initialState, taskId);
    }

    private void runGraph(String taskId, DecisionState initialState, String checkpointThreadId) {
        RunnableConfig config = RunnableConfig.builder().threadId(checkpointThreadId).build();
        try {
            Map<String, Object> stateData = (initialState != null) ? initialState.data() : null;
            Optional<DecisionState> resultOpt = getCompiledGraph().invoke(stateData, config);
            if (resultOpt.isPresent()) {
                DecisionState finalState = resultOpt.get();
                eventPublisher.publishEvent(new WorkflowCompletedEvent(this, taskId, finalState.getDecisionId(), finalState.data()));
            } else {
                eventPublisher.publishEvent(new WorkflowFailedEvent(
                        this, taskId, new IllegalStateException("Workflow execution returned empty result")));
            }
        } catch (Exception e) {
            log.error("Failed to execute graph for task {}", taskId, e);
            eventPublisher.publishEvent(new WorkflowFailedEvent(this, taskId, e));
        }
    }

    @Override
    public CompiledGraph<DecisionState> getCompiledGraph() {
        return decisionWorkflow.getGraph();
    }
}
