package qg.po.midterm.common.enums;

import lombok.Getter;

/**
 * 系统对外错误码（API v2.0 2.3 节）
 */
@Getter
public enum ErrorCode {

    SUCCESS(0, "success"),
    BAD_REQUEST(40001, "参数校验失败"),
    UNAUTHORIZED(40101, "未登录或Token已失效"),
    NOT_FOUND(40401, "资源不存在或已删除"),
    CONFLICT(40901, "状态冲突或重复提交"),
    AI_VALIDATION_FAILED(42201, "AI结果结构校验失败"),
    INTERNAL_ERROR(50001, "服务端错误");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
