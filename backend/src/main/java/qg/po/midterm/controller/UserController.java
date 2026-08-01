package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.service.AuthService;
import qg.po.midterm.vo.UserVO;

/**
 * 用户接口：当前登录用户信息（PRD 第 5.3 节）
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    /**
     * 5.3 获取当前登录用户
     * <p>根据 JWT 获取当前登录用户信息，需携带 Authorization: Bearer 请求头。
     */
    @GetMapping("/me")
    public Result<UserVO> getCurrentUser() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return Result.success(authService.getCurrentUser(userId));
    }
}
