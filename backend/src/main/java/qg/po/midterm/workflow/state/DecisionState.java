package qg.po.midterm.workflow.state;

import org.bsc.langgraph4j.state.AgentState;

import java.util.Map;

public class DecisionState extends AgentState {

    public DecisionState(Map<String, Object> initData) {
        super(initData);
    }

    public String getDecisionId() {
        return value("decisionId").map(Object::toString).orElse(null);
    }

    public String getTaskId() {
        return value("taskId").map(Object::toString).orElse(null);
    }

    public String getBackground() {
        return value("background").map(Object::toString).orElse(null);
    }

    public String getGoal() {
        return value("goal").map(Object::toString).orElse(null);
    }

    public String getConstraints() {
        return value("constraints").map(Object::toString).orElse(null);
    }

    public String getUnderstanding() {
        return value("understanding").map(Object::toString).orElse(null);
    }

    @SuppressWarnings("unchecked")
    public java.util.List<Factor> getFactors() {
        return value("factors").map(v -> (java.util.List<Factor>) v).orElse(null);
    }

    @SuppressWarnings("unchecked")
    public java.util.List<Factor> getPreviousFactors() {
        return value("previousFactors")
                .map(v -> (java.util.List<Factor>) v)
                .orElse(java.util.List.of());
    }

    @SuppressWarnings("unchecked")
    public java.util.List<Option> getOptions() {
        return value("options").map(v -> (java.util.List<Option>) v).orElse(null);
    }

    @SuppressWarnings("unchecked")
    public java.util.List<String> getOptionIdsToEnrich() {
        return value("optionIdsToEnrich")
                .map(v -> (java.util.List<String>) v)
                .orElse(java.util.List.of());
    }

    public qg.po.midterm.dto.result.AnalysisResultDto.Recommendation getRecommendation() {
        return value("recommendation").map(v -> (qg.po.midterm.dto.result.AnalysisResultDto.Recommendation) v).orElse(null);
    }

    @SuppressWarnings("unchecked")
    public java.util.List<String> getNextActions() {
        return value("nextActions").map(v -> (java.util.List<String>) v).orElse(null);
    }

    public String getErrorMsg() {
        return value("errorMsg").map(Object::toString).orElse(null);
    }

    public int getRetryCount() {
        return value("retryCount").map(v -> (Integer) v).orElse(0);
    }

    public boolean isRepairAttempted() {
        return value("repairAttempted").map(v -> Boolean.parseBoolean(v.toString())).orElse(false);
    }
}
