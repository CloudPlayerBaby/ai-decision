package qg.po.midterm.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AnalysisTaskVO {

    private Long id;
    private String title;
    private String description;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
