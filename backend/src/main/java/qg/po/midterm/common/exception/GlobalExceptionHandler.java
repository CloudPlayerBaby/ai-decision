package qg.po.midterm.common.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.result.Result;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 全局异常处理器。
 *
 * <p>作用：使用 AOP 切面思想，拦截所有 Controller 抛出的未捕获异常。
 * 避免将原生报错（如 500 堆栈、未处理的 400 提示）直接抛给前端，
 * 统一将各种异常转换为标准化接口响应格式 {@link Result} + 适当的 HTTP 状态码。
 */
@Slf4j // Lombok 注解，自动生成 log 日志对象（用来记录日志 log.warn / log.error）
@RestControllerAdvice // 相当于 @ControllerAdvice + @ResponseBody，表明这是个全局控制器增强类，所有方法返回值自动转 JSON
public class GlobalExceptionHandler {

    // =========================================================================
    // 1. 拦截【参数校验失败异常】（如 @Valid / @Validated 校验注解不通过时抛出的异常）
    // =========================================================================
    /**
     * 当前端传参不符合注解要求（例如实体类属性加了 @NotNull, @NotBlank, @Size 等）时触发。
     *
     * @param ex Spring 捕获到的参数校验异常对象
     * @return 400 Bad Request 状态码，并在 Result 中返回包含【具体属性名 -> 错误原因】的 Map
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Map<String, String>>> handleValidation(MethodArgumentNotValidException ex) {
        // 使用 LinkedHashMap 保持字段报错的先后顺序
        Map<String, String> errors = new LinkedHashMap<>();

        // 遍历所有校验失败的字段，提取 "字段名" 和 "默认错误提示文本"
        // 比如：username -> "用户名不能为空", age -> "年龄不能小于18"
        ex.getBindingResult().getFieldErrors().forEach(e ->
                errors.put(e.getField(), e.getDefaultMessage()));

        // 返回 HTTP 400 状态码，Result.data 中附带错误明细 Map
        io.sentry.Sentry.captureException(ex); // 主动上报给 Sentry
        return ResponseEntity.badRequest()
                .body(Result.fail(ErrorCode.BAD_REQUEST.getCode(), ErrorCode.BAD_REQUEST.getMessage(), errors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Result<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        io.sentry.Sentry.captureException(ex); // 主动上报给 Sentry
        return ResponseEntity.badRequest()
                .body(Result.fail(ErrorCode.BAD_REQUEST.getCode(), ex.getMessage()));
    }

    // =========================================================================
    // 2. 拦截【自定义业务异常】（手动 throw new BusinessException(...) 抛出的异常）
    // =========================================================================
    /**
     * 处理程序员在 Service / 业务代码中主动抛出的 BusinessException 异常。
     * 比如：余额不足、用户不存在、AI 输出校验不通过等。
     *
     * @param ex 业务异常实例，包含了内部定义的 ErrorCode
     * @return 根据 ErrorCode 动态匹配对应的 HTTP 状态码，并返回统一错误 Result
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException ex) {
        ErrorCode errorCode = ex.getErrorCode();

        // 使用 Java 14+ 的增强 switch 表达式，将自定义的 ErrorCode 映射到标准 HTTP 响应状态码
        HttpStatus httpStatus = switch (errorCode) {
            case BAD_REQUEST -> HttpStatus.BAD_REQUEST;                 // 400 参数或请求非法
            case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;               // 401 未登录/未授权
            case NOT_FOUND -> HttpStatus.NOT_FOUND;                     // 404 资源不存在
            case CONFLICT -> HttpStatus.CONFLICT;                       // 409 业务状态冲突（如账号已存在）
            case AI_VALIDATION_FAILED -> HttpStatus.UNPROCESSABLE_ENTITY; // 422 语法正确但无法处理（适合 AI 生成结果校验失败）
            case INTERNAL_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;   // 500 服务器内部错误
            default -> HttpStatus.OK;                                   // 兜底返回 200 OK
        };

        // 业务异常通常是预期内的错误（非系统崩塌），因此用 WARN 警告级别记录日志即可
        log.warn("业务异常: code={}, message={}", errorCode.getCode(), ex.getMessage());
        io.sentry.Sentry.captureException(ex); // 主动上报给 Sentry

        // 返回匹配的 HTTP 状态码和失败的结果体
        return ResponseEntity.status(httpStatus)
                .body(Result.fail(errorCode.getCode(), ex.getMessage()));
    }

    // =========================================================================
    // 3. 拦截【未知的系统未捕获异常】（兜底终极拦截器）
    // =========================================================================
    /**
     * 拦截所有未被上述方法捕获的空指针异常 (NPE)、数据库断开连接、数组越界等未预料到的系统异常。
     *
     * @param ex 任何未处理的 Exception 根类实例
     * @return 统一返回 HTTP 500 状态码 + "服务端内部错误" 友好提示，避免将敏感堆栈暴露给外部用户
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleException(Exception ex) {
        // 未知的未知错误，用 ERROR 级别打印完整堆栈日志，方便运维/开发者排查 Bug
        log.error("服务端错误", ex);
        io.sentry.Sentry.captureException(ex); // 主动上报给 Sentry

        // 统一屏蔽内部实现细节，对外暴露安全的 500 错误提示
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.fail(ErrorCode.INTERNAL_ERROR.getCode(), ErrorCode.INTERNAL_ERROR.getMessage()));
    }
}
