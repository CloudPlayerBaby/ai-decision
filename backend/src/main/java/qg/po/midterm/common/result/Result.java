package qg.po.midterm.common.result;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

/**
 * 统一封装后端接口返回结果。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 业务码：0 表示成功，非 0 表示失败
     */
    private Integer code;

    /**
     * 响应信息
     */
    private String message;

    /**
     * 业务数据
     */
    private T data;

    /**
     * 成功，不携带数据
     */
    public static Result<Void> success() {
        return new Result<>(0, "success", null);
    }

    /**
     * 成功，携带数据
     */
    public static <T> Result<T> success(T data) {
        return new Result<>(0, "success", data);
    }

    /**
     * 成功，自定义提示信息
     */
    public static <T> Result<T> success(String message, T data) {
        return new Result<>(0, message, data);
    }

    /**
     * 失败
     */
    public static Result<Void> fail(Integer code, String message) {
        return new Result<>(code, message, null);
    }

    /**
     * 失败，携带错误详情
     */
    public static <T> Result<T> fail(Integer code, String message, T data) {
        return new Result<>(code, message, data);
    }
}