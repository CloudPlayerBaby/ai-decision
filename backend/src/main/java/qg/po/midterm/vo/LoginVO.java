package qg.po.midterm.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoginVO {
    private String accessToken;
    private String tokenType;
    private Integer expiresIn;
    private UserVO user;
}
