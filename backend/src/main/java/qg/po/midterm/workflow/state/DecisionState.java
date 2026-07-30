package qg.po.midterm.workflow.state;

import org.bsc.langgraph4j.state.AgentState;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class DecisionState extends AgentState {

    public DecisionState(Map<String, Object> initData) {
        super(initData);
    }

    public String getTargetStartNode() {
        return (String) data().get("targetStartNode");
    }

    public void setTargetStartNode(String targetStartNode) {
        data().put("targetStartNode", targetStartNode);
    }

    public String getBackground() {
        return (String) data().get("background");
    }

    public void setBackground(String background) {
        data().put("background", background);
    }

    public String getGoal() {
        return (String) data().get("goal");
    }

    public void setGoal(String goal) {
        data().put("goal", goal);
    }

    public String getConstraints() {
        return (String) data().get("constraints");
    }

    public void setConstraints(String constraints) {
        data().put("constraints", constraints);
    }

    public String getUnderstanding() {
        return (String) data().get("understanding");
    }

    public void setUnderstanding(String understanding) {
        data().put("understanding", understanding);
    }

    @SuppressWarnings("unchecked")
    public List<Factor> getFactors() {
        return (List<Factor>) data().get("factors");
    }

    public void setFactors(List<Factor> factors) {
        data().put("factors", factors);
    }

    @SuppressWarnings("unchecked")
    public List<Option> getOptions() {
        return (List<Option>) data().get("options");
    }

    public void setOptions(List<Option> options) {
        data().put("options", options);
    }

    public String getRecommendation() {
        return (String) data().get("recommendation");
    }

    public void setRecommendation(String recommendation) {
        data().put("recommendation", recommendation);
    }

    public String getNextActions() {
        return (String) data().get("nextActions");
    }

    public void setNextActions(String nextActions) {
        data().put("nextActions", nextActions);
    }

    public String getErrorMsg() {
        return (String) data().get("errorMsg");
    }

    public void setErrorMsg(String errorMsg) {
        data().put("errorMsg", errorMsg);
    }

    public int getRetryCount() {
        Object count = data().get("retryCount");
        return count != null ? (Integer) count : 0;
    }

    public void setRetryCount(int retryCount) {
        data().put("retryCount", retryCount);
    }
}
