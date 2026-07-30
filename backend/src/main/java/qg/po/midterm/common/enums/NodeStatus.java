package qg.po.midterm.common.enums;

import lombok.Getter;

/**
 * 工作流节点的执行状态。
 */
@Getter
public enum NodeStatus {

    WAITING("尚未执行，等待前置节点"),
    RUNNING("执行中"),
    SUCCEEDED("已成功"),
    FAILED("失败");

    private final String description;

    NodeStatus(String description) {
        this.description = description;
    }
}
