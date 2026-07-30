package qg.po.midterm.common.enums;

import lombok.Getter;

@Getter
public enum NodeStatus {

    PENDING("待执行"),
    RUNNING("执行中"),
    COMPLETED("已完成"),
    SKIPPED("已跳过"),
    FAILED("失败");

    private final String description;

    NodeStatus(String description) {
        this.description = description;
    }
}
