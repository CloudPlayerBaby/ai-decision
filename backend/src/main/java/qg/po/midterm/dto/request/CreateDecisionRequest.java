package qg.po.midterm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 创建决策问题请求（API v2.0 6.1 节）
 */
@Data
public class CreateDecisionRequest {

    /** 1–100 字 */
    @NotBlank(message = "title 不能为空")
    @Size(max = 100, message = "title 不能超过100个字符")
    private String title;

    /** 问题背景，最大 2000 字（可选） */
    @Size(max = 2000, message = "background 不能超过2000个字符")
    private String background;

    /** 决策目标，1–1000 字 */
    @NotBlank(message = "goal 不能为空")
    @Size(max = 1000, message = "goal 不能超过1000个字符")
    private String goal;

    /** 约束条件，自由文本（可选） */
    private String constraints;
}
