/**
 * RSA 公钥（与后端 backend/src/main/resources/rsa/public_key.pem 一致）。
 * 登录/注册提交前用此公钥加密 password 字段；后端用配对私钥解密后再 BCrypt 校验。
 */
export const RSA_PUBLIC_KEY = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAttIDG9u/Ag+1odUe5brC+54CFdFfHrjuC15piR73qx2tOquiRboE
UB2Zsq681ABEtaUS2bk1ihjm2kjoHOCwAZgXM2WSS+pAl5yTcfpGY33mpqQGKwgD
erUEhMgEReXD6JSoGRR3vV6CDVmrGbrw4Jhvjbi3WW3bKsEtFtwtF79wbHOp5Huz
IIMY7l7yRljUF7wl1Hnwsc+VfYPnd1KNT0pR7b4z8xOHM7F6rq/jQ1ByEsA4Stnt
x8WJE67C4seMyTOxY5EbVriR4x0lstULjzw8Qkuqu4fOAbVn4+JpfH9CjqvBNecH
Pwyg+E3scliNZYXywo7eMWS1RjkHPcXnnwIDAQAB
-----END RSA PUBLIC KEY-----`
