package qg.po.midterm.dto.request;

import lombok.Data;

@Data
public class ReplayDecisionRequest {

    private Long originalTaskId;
    private String replayReason;
}
