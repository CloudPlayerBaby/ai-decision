package qg.po.midterm.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DecisionNode {

    private Long id;
    private Long taskId;
    private String nodeName;
    private String status;
    private String inputData;
    private String outputData;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
}
