package qg.po.midterm.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Report {

    private Long id;
    private Long taskId;
    private String title;
    private String content;
    private LocalDateTime createTime;
}
