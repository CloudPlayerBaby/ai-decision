package qg.po.midterm.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class JwtUtil {

    private final Algorithm algorithm;
    private final int expiration;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration}") int expiration) {
        this.algorithm = Algorithm.HMAC256(secret);
        this.expiration = expiration;
    }

    public String generateToken(Long userId, String username) {
        Instant now = Instant.now();
        return JWT.create()
                .withSubject(String.valueOf(userId))
                .withClaim("username", username)
                .withIssuedAt(now)
                .withExpiresAt(now.plus(expiration, ChronoUnit.SECONDS))
                .sign(algorithm);
    }

    public DecodedJWT validateToken(String token) throws JWTVerificationException {
        return JWT.require(algorithm).build().verify(token);
    }

    public Long getUserId(DecodedJWT jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
