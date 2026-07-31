package qg.po.midterm.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("decision_solution")
public class DecisionSolution {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long decisionId;
}
