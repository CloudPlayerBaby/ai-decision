package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisLogVO {

    private String eventId;
    private String event;
    private OffsetDateTime occurredAt;
    private Map<String, Object> data;
}
