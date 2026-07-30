package qg.po.midterm.dto.request;

import lombok.Data;

@Data
public class ConfirmDecisionRequest {

    private Long taskId;
    private Long optionId;
}
