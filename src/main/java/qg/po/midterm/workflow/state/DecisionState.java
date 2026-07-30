package qg.po.midterm.workflow.state;

import lombok.Data;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Data
public class DecisionState {

    private Long taskId;
    private Map<String, Object> attributes = new ConcurrentHashMap<>();
}
