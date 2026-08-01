package qg.po.midterm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.dto.request.LoginRequest;
import qg.po.midterm.dto.request.RegisterRequest;
import qg.po.midterm.entity.SysUser;
import qg.po.midterm.mapper.SysUserMapper;
import qg.po.midterm.security.JwtUtil;
import qg.po.midterm.service.AuthService;
import qg.po.midterm.vo.LoginVO;
import qg.po.midterm.vo.UserVO;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final SysUserMapper sysUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    // 注册，并检查用户名和邮箱
    @Override
    public UserVO register(RegisterRequest request) {
        if (sysUserMapper.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, request.getUsername())) > 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "用户名已存在");
        }
        if (sysUserMapper.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getEmail, request.getEmail())) > 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "邮箱已注册");
        }

        SysUser user = new SysUser();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        sysUserMapper.insert(user);

        return toUserVO(user);
    }

    // 登录
    @Override
    public LoginVO login(LoginRequest request) {
        String account = request.getAccount();
        SysUser user = sysUserMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, account)
                .or()
                .eq(SysUser::getEmail, account));
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "账号或密码错误");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "账号或密码错误");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());
        return LoginVO.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(7200)
                .user(toUserVO(user))
                .build();
    }

    // 根据 userId 获取当前登录的用户信息
    @Override
    public UserVO getCurrentUser(Long userId) {
        SysUser user = sysUserMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        return toUserVO(user);
    }

    // 转成 userVO
    private UserVO toUserVO(SysUser user) {
        return UserVO.builder()
                .id("u_" + user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
