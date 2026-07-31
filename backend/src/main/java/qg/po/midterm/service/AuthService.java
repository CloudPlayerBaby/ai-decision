package qg.po.midterm.service;

import qg.po.midterm.dto.request.LoginRequest;
import qg.po.midterm.dto.request.RegisterRequest;
import qg.po.midterm.vo.LoginVO;
import qg.po.midterm.vo.UserVO;

public interface AuthService {

    UserVO register(RegisterRequest request);

    LoginVO login(LoginRequest request);

    UserVO getCurrentUser(Long userId);
}
