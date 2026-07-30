package qg.po.midterm.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DecisionOption {

    private Long id;
    private Long decisionId;
    private String optionName;
    private String analysis;
    private Double score;
    private LocalDateTime createTime;
}
