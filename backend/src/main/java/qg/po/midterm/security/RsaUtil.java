package qg.po.midterm.security;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * RSA 解密工具：前端用公钥加密密码后传输，后端用私钥解密还原明文。
 * <p>配合前端 JSEncrypt（RSA PKCS#1 v1.5）使用，加解密填充方式需保持一致。
 */
@Component
public class RsaUtil {

    /** 与前端 JSEncrypt 默认填充方式保持一致 */
    private static final String ALGORITHM = "RSA/ECB/PKCS1Padding";

    private static final String PRIVATE_KEY_PATH = "rsa/private_key.pem";

    private final PrivateKey privateKey;

    public RsaUtil() throws Exception {
        this.privateKey = loadPrivateKey();
    }

    /**
     * 解密 Base64 密文。
     *
     * @throws Exception 密文非法或非当前公钥加密时抛出
     */
    public String decrypt(String base64Cipher) throws Exception {
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, privateKey);
        byte[] plain = cipher.doFinal(Base64.getDecoder().decode(base64Cipher));
        return new String(plain, StandardCharsets.UTF_8);
    }

    /**
     * 向后兼容：前端切到密文前可能仍发明文。
     * 密文能解出来就解，解不出来（说明是明文或脏数据）原样返回，避免登录/注册流程被卡死。
     * 等所有前端都切到加密后，可改为直接调用 {@link #decrypt}。
     */
    public String decryptOrPlain(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        try {
            return decrypt(value);
        } catch (Exception ignored) {
            return value;
        }
    }

    private PrivateKey loadPrivateKey() throws Exception {
        ClassPathResource resource = new ClassPathResource(PRIVATE_KEY_PATH);
        String pem = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        String base64 = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        return KeyFactory.getInstance("RSA")
                .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
    }
}
