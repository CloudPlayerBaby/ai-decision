package qg.po.midterm.dto.request;

import lombok.Data;

/**
 * 创建决策问题请求（API v2.0 6.1 节）
 */
@Data
public class CreateDecisionRequest {

    /** 1–100 字 */
    private String title;

    /** 问题背景，最大 2000 字（可选） */
    private String background;

    /** 决策目标，1–1000 字 */
    private String goal;

    /** 约束条件，自由文本（可选） */
    private String constraints;
}
