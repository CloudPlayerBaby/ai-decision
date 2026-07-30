package qg.po.midterm.common.enums;

import lombok.Getter;

/**
 * 决策问题状态枚举（API v2.0 3.1 节）
 */
@Getter
public enum DecisionStatus {

    PENDING("已创建，尚未推演"),
    ANALYZING("整轮推演进行中"),
    PARTIAL_ANALYZING("局部重推进行中"),
    WAITING_CONFIRM("结构化结果已通过校验，等待用户确认"),
    COMPLETED("报告已正式生成"),
    FAILED("推演或报告生成失败");

    private final String description;

    DecisionStatus(String description) {
        this.description = description;
    }
}
