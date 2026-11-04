/**
 * 登录传输加密工具（Web Crypto API，无第三方依赖）
 *
 * 流程：
 * 1. 从后端 loginKey 查询获取 RSA-2048 公钥（PEM）；
 * 2. 使用 RSA-OAEP(SHA-256) 加密用户名/密码；
 * 3. 密文 base64 后随 login 请求发送，后端用内存私钥解密。
 *
 * 密钥由后端进程启动时生成、仅存内存，重启即轮换；
 * 前端不缓存公钥，保证每次登录使用的都是当前有效公钥。
 */

import { graphqlRequest } from "@/api/graphql";

/** PEM 文本 -> ArrayBuffer（剥离头尾与换行后 base64 解码） */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

/** ArrayBuffer -> base64 字符串 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

/** 从后端获取登录加密公钥并导入为 CryptoKey */
async function fetchLoginPublicKey(): Promise<CryptoKey> {
  const data = await graphqlRequest(
    `query LoginKey {
      loginKey { publicKey algorithm }
    }`
  );
  const pem = (data?.loginKey?.publicKey || "") as string;
  if (!pem) {
    throw new Error("获取登录加密公钥失败");
  }
  return crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(pem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

/** RSA-OAEP(SHA-256) 加密单个字段，返回 base64 密文 */
async function encryptField(key: CryptoKey, plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, encoded);
  return arrayBufferToBase64(cipher);
}

/**
 * 加密登录凭据：返回可直接放入 LoginInput 的字段。
 * 安全上下文（HTTPS / localhost）下经 loginKey 公钥 RSA-OAEP(SHA-256) 加密（encrypted=true）；
 * 纯 HTTP 访问时浏览器不提供 Web Crypto，回退为明文提交（encrypted=false，后端兼容），
 * 并在控制台提示凭据未加密；获取公钥或加密失败时抛错，调用方应中止登录并提示。
 */
export async function encryptLoginCredentials(
  username: string,
  password: string
): Promise<{ username: string; password: string; encrypted: boolean }> {
  // Web Crypto 仅在安全上下文（HTTPS/localhost）暴露，HTTP 访问时降级明文
  if (typeof window !== "undefined" && (!window.crypto || !window.crypto.subtle)) {
    console.warn(
      "当前经 HTTP 访问，登录凭据将明文传输；生产环境建议启用 HTTPS（网关 TLS）以恢复加密传输"
    );
    return { username, password, encrypted: false };
  }
  const key = await fetchLoginPublicKey();
  const [encUser, encPass] = await Promise.all([
    encryptField(key, username),
    encryptField(key, password),
  ]);
  return { username: encUser, password: encPass, encrypted: true };
}
