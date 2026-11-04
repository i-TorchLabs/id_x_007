"""登录传输加密：RSA-2048 密钥对（进程内存态，重启即换）。

- 公钥经 loginKey 查询下发给前端，前端使用 Web Crypto RSA-OAEP(SHA-256) 加密用户名/密码；
- 私钥仅驻留后端内存，用于 view_login 解密；
- 密钥不落盘、不进配置，进程重启自动轮换，已加密的在途请求随之失效（前端重新取公钥即可）。
"""
from __future__ import annotations

import base64
import binascii

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

# 启动时生成一次性 RSA-2048 密钥对（仅内存）
_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)

_PUBLIC_PEM = _PRIVATE_KEY.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
).decode("ascii")

# RSA-2048 + OAEP(SHA-256) 单次最大明文长度：2048/8 - 2*32 - 2 = 190 字节
_MAX_PLAINTEXT_BYTES = 190


def public_key_pem() -> str:
    """返回 PEM 格式公钥（可安全公开）。"""
    return _PUBLIC_PEM


def decrypt_field(ciphertext_b64: str) -> str | None:
    """RSA-OAEP(SHA-256) 解密 base64 密文；非法输入/解密失败返回 None（不抛异常）。"""
    if not ciphertext_b64:
        return None
    try:
        ciphertext = base64.b64decode(ciphertext_b64, validate=True)
    except (binascii.Error, ValueError):
        return None
    # RSA-2048 密文定长 256 字节，长度不符直接拒绝，避免无谓计算
    if len(ciphertext) != 256:
        return None
    try:
        plaintext = _PRIVATE_KEY.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
    except ValueError:
        return None
    try:
        text = plaintext.decode("utf-8")
    except UnicodeDecodeError:
        return None
    # 长度上限防御：解密出的明文不应超过 RSA 块容量
    if len(plaintext) > _MAX_PLAINTEXT_BYTES:
        return None
    return text
