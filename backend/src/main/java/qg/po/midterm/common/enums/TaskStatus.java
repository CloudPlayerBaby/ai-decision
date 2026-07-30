package qg.po.midterm.common.enums;

import lombok.Getter;

/**
 * 推演任务与步骤的执行状态（API v2.0 3.2 节）
 */
@Getter
public enum TaskStatus {

    WAITING("尚未执行，等待前置步骤"),
    RUNNING("执行中"),
    SUCCEEDED("已成功，结果持久化"),
    FAILED("失败");

    private final String description;

    TaskStatus(String description) {
        this.description = description;
    }
}
