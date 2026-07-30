package qg.po.midterm.common.exception;

import lombok.Getter;
import qg.po.midterm.common.enums.ErrorCode;

/**
 * 表示可预期的业务异常
 */
@Getter
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, String detailMessage) {
        super(errorCode.getMessage() + ": " + detailMessage);
        this.errorCode = errorCode;
    }
}
