package qg.po.midterm.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DecisionVO {

    private Long id;
    private Long taskId;
    private String content;
    private LocalDateTime createTime;
}
