package qg.po.midterm.workflow.state;

import org.bsc.langgraph4j.state.AgentState;
import java.util.Map;

public class DecisionState extends AgentState {

    public DecisionState(Map<String, Object> initData) {
        super(initData);
    }

    public String getTargetStartNode() {
        return value("targetStartNode").map(Object::toString).orElse(null);
    }

    public String getErrorMsg() {
        return value("errorMsg").map(Object::toString).orElse(null);
    }

    public int getRetryCount() {
        return value("retryCount").map(v -> (Integer) v).orElse(0);
    }
}
