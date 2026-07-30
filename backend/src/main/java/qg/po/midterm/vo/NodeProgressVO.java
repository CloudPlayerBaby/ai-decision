package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NodeProgressVO {

    private String id;
    private String name;
    private String displayName;
    private String status;
    private OffsetDateTime startedAt;
    private OffsetDateTime endedAt;
    private String summary;
}
