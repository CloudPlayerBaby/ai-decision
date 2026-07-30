package qg.po.midterm.vo;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserVO {
    private String id;
    private String username;
    private String email;
    private LocalDateTime createdAt;
}
