package qg.po.midterm.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * JWT (JSON Web Token) 操作工具类。
 *
 * <p>基于 auth0 的 java-jwt 库封装。
 * 主要提供三个核心功能：
 * 1. 生成 Token (generateToken) — 用户登录成功后调用
 * 2. 校验 Token (validateToken) — 过滤器拦截请求时调用
 * 3. 获取用户数据 (getUserId) — 从 Token 中提取用户身份信息
 */
@Component // 注入到 Spring 容器，供 UserService、JwtAuthenticationFilter 等类直接注入使用
public class JwtUtil {

    // 加密算法对象（包含秘钥 secret）
    private final Algorithm algorithm;

    // Token 的有效时长（单位：秒）
    private final int expiration;

    /**
     * 构造方法注入配置参数。
     *
     * @param secret 从 application.yml 中的 ${jwt.secret} 读取秘钥（注意：秘钥必须保密，不能泄露）
     * @param expiration 从 application.yml 中的 ${jwt.expiration} 读取过期时间（比如 86400 秒 = 24 小时）
     */
    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration}") int expiration) {
        // 使用 HMAC256 对称加密算法，传入自定义秘钥进行初始化
        this.algorithm = Algorithm.HMAC256(secret);
        this.expiration = expiration;
    }

    // =========================================================================
    // 1. 生成 JWT Token
    // =========================================================================
    /**
     * 根据用户信息生成加密的 JWT 字符串。
     *
     * @param userId   用户 ID（存入 Subject）
     * @param username 用户名（存入自定义 Claim）
     * @return 签发完成的 JWT 字符串（如 eyJhbGciOiJIUzI1Ni...）
     */
    public String generateToken(Long userId, String username) {
        Instant now = Instant.now(); // 获取当前时间戳（UTC 时间）

        return JWT.create()
                .withSubject(String.valueOf(userId))                      // 设置主题：存储用户 ID（唯一标识）
                .withClaim("username", username)                         // 存入自定义属性：用户名
                .withIssuedAt(now)                                       // 设置 Token 签发时间（iat）
                .withExpiresAt(now.plus(expiration, ChronoUnit.SECONDS)) // 设置 Token 过期时间（exp = 当前时间 + 过期秒数）
                .sign(algorithm);                                        // 使用 HMAC256 算法和秘钥生成最终签名并返回
    }

    // =========================================================================
    // 2. 校验 JWT Token
    // =========================================================================
    /**
     * 验证 Token 的合法性（签名是否正确、是否过期等）。
     *
     * @param token 前端传上来的 JWT 字符串
     * @return 解析后的 JWT 对象（DecodedJWT）
     * @throws JWTVerificationException 如果 Token 过期、被篡改或格式错误，会抛出此异常
     */
    public DecodedJWT validateToken(String token) throws JWTVerificationException {
        // 创建校验器并对 Token 进行签名和防篡改验证
        return JWT.require(algorithm).build().verify(token);
    }

    // =========================================================================
    // 3. 从已解析的 JWT 中提取用户 ID
    // =========================================================================
    /**
     * 从解密后的 JWT 对象中读取用户 ID。
     *
     * @param jwt 已经校验通过的 DecodedJWT 对象
     * @return 用户 ID (Long)
     */
    public Long getUserId(DecodedJWT jwt) {
        // 从 Subject 中取出当初存入的 String 类型 userId，并转成数字型 Long 返回
        return Long.parseLong(jwt.getSubject());
    }
}