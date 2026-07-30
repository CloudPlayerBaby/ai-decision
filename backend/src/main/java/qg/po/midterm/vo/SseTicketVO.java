package qg.po.midterm.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SSE Ticket 接口返回数据。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SseTicketVO {

    private String sseUrl;
    private Integer expiresIn;
}
