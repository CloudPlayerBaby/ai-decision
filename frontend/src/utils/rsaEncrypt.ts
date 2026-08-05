import JSEncrypt from 'jsencrypt'
import { RSA_PUBLIC_KEY } from '@/config/rsaPublicKey'

/** 使用内置公钥 RSA 加密明文密码，返回 Base64 密文 */
export function encryptPassword(plainPassword: string): string | false {
  const encrypt = new JSEncrypt()
  encrypt.setPublicKey(RSA_PUBLIC_KEY)
  return encrypt.encrypt(plainPassword)
}
