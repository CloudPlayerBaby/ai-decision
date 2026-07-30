package qg.po.midterm.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AnalysisTask {

    private Long id;
    private String title;
    private String description;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
