package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisTaskVO {

    private String id;
    private String status;
    private Integer progress;
    private List<NodeProgressVO> steps;
    private String lastEventId;
    private TaskErrorVO error;
}
