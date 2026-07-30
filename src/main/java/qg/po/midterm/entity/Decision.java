package qg.po.midterm.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Decision {

    private Long id;
    private Long taskId;
    private Long confirmedOptionId;
    private String content;
    private LocalDateTime createTime;
}
