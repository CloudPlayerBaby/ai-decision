package qg.po.midterm.common.enums;

import lombok.Getter;

@Getter
public enum TaskStatus {

    PENDING("待处理"),
    IN_PROGRESS("进行中"),
    COMPLETED("已完成"),
    FAILED("失败");

    private final String description;

    TaskStatus(String description) {
        this.description = description;
    }
}
