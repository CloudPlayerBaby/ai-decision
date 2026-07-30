package qg.po.midterm.security;

import com.auth0.jwt.interfaces.DecodedJWT;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT 身份认证过滤器。
 *
 * <p>继承 {@link OncePerRequestFilter} 保证在一个请求生命周期内，该过滤器**只会被执行一次**。
 * <p>主要职责：
 * 1. 拦截 HTTP 请求，检查 Authorization 请求头中的 Bearer Token。
 * 2. 验证 JWT 的合法性并解析出用户 ID。
 * 3. 将验证通过的用户身份（Authentication）填充到 Spring Security 的上下文环境（SecurityContextHolder）中，
 *    使后续的控制器（Controller）或权限拦截器能够识别当前操作的用户身份。
 */
@Component // 注入到 Spring 容器，方便在 Spring Security 配置类（SecurityConfig）中引入
@RequiredArgsConstructor // Lombok 注解，自动为 final 字段（jwtUtil）生成构造方法实现依赖注入
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    // 注入自定义的 JWT 工具类，用于 Token 的解析与校验
    private final JwtUtil jwtUtil;

    /**
     * 过滤器的核心执行逻辑。
     *
     * @param request  HTTP 请求对象
     * @param response HTTP 响应对象
     * @param chain    过滤器链（用于将请求传递给下一个过滤器）
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        // 1. 从 HTTP 请求头中获取名为 "Authorization" 的 Header
        String header = request.getHeader("Authorization");

        // 2. 检查 Header 是否为空，或者是否以标准的前缀 "Bearer " 开头
        // 如果没有携带 Token 或者格式不对（比如游客访问不需要登录的接口，或者传错了格式）
        if (header == null || !header.startsWith("Bearer ")) {
            // 直接放行，让请求继续走后续的过滤器链（如果访问的是受保护接口，Spring Security 后面会自动拦截并报 401）
            chain.doFilter(request, response);
            return;
        }

        // 3. 截取掉 "Bearer " 前缀（共 7 个字符），拿到真正的 JWT 字符串
        String token = header.substring(7);

        try {
            // 4.1 校验 Token（检查签名是否合法、是否过期等）
            DecodedJWT jwt = jwtUtil.validateToken(token);

            // 4.2 从解析后的 JWT 中提取存储的用户 ID (userId)
            Long userId = jwtUtil.getUserId(jwt);

            // 4.3 创建 Spring Security 认识的认证凭证对象（Authentication）
            // 参数说明：
            // - principal (主体): 存 userId（后续在 Controller 中可通过 SecurityContext 获取）
            // - credentials (密码/凭证): 已使用 JWT 认证通过，此处填 null 即可
            // - authorities (权限列表): 目前传空列表 List.of()，如果后续有角色/权限控制，在这里填充对应 GrantedAuthority
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(userId, null, List.of());

            // 4.4 核心步骤：将创建好的认证信息写入 Spring Security 的安全上下文中
            // 只要这一步写入成功，Spring Security 就认为本次请求的用户是已登录状态
            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (Exception ignored) {
            // 5. Token 校验失败（比如 Token 伪造、过期、非法修改等）
            // 这里选择静默捕获异常：不人为抛出错误，保持 SecurityContext 为空（即未登录状态）。
            // 后续的 Spring Security 拦截规则（如 .authenticated()）发现 Context 为空时，会自动返回 401 Unauthorized。
        }

        // 6. 执行完成，将请求传递给下一个过滤器
        chain.doFilter(request, response);
    }
}