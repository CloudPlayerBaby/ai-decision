package qg.po.midterm.common.exception;

import lombok.Getter;
import qg.po.midterm.common.enums.ErrorCode;
import java.util.List;

@Getter
public class AiValidationException extends BusinessException {

    private final List<String> missingFields;
    private final boolean repairAttempted;

    public AiValidationException(String message, List<String> missingFields, boolean repairAttempted) {
        super(ErrorCode.AI_VALIDATION_FAILED, message);
        this.missingFields = missingFields;
        this.repairAttempted = repairAttempted;
    }
}
