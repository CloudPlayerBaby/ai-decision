package qg.po.midterm.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ReportVO {

    private Long id;
    private Long taskId;
    private String title;
    private String content;
    private LocalDateTime createTime;
}
