package qg.po.midterm.common.enums;

import lombok.Getter;

@Getter
public enum ErrorCode {

    SUCCESS(200, "成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "禁止访问"),
    NOT_FOUND(404, "资源不存在"),
    INTERNAL_ERROR(500, "服务器内部错误"),
    AI_SERVICE_ERROR(5001, "AI服务调用失败"),
    WORKFLOW_ERROR(5002, "工作流执行异常");

    private final Integer code;
    private final String message;

    ErrorCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
