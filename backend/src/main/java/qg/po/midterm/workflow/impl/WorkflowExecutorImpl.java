package qg.po.midterm.workflow.impl;

import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.CompiledGraph;
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
        runGraph(taskId, new DecisionState(initData));
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
    public void runGraph(String taskId, DecisionState initialState) {
        try {
            Map<String, Object> stateData = (initialState != null) ? initialState.data() : null;
            Optional<DecisionState> resultOpt = getCompiledGraph().invoke(stateData);
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
