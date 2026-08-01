package qg.po.midterm.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.dto.request.LoginRequest;
import qg.po.midterm.dto.request.RegisterRequest;
import qg.po.midterm.service.AuthService;
import qg.po.midterm.vo.LoginVO;
import qg.po.midterm.vo.UserVO;

/**
 * 认证接口：用户注册与登录（PRD 第 5 节）
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * 5.1 用户注册
     * <p>创建新用户并返回用户信息。username 3-30 位字母数字下划线且唯一，email 合法且唯一，password 8-64 位含字母和数字。
     */
    @PostMapping("/register")
    public Result<UserVO> register(@Valid @RequestBody RegisterRequest request) {
        return Result.success(authService.register(request));
    }

    /**
     * 5.2 用户登录
     * <p>支持邮箱或用户名登录，返回 JWT（Bearer）与用户信息。
     */
    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginRequest request) {
        return Result.success(authService.login(request));
    }
}
