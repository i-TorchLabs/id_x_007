"""口令安全：PBKDF2-HMAC-SHA256 哈希与校验（兼容旧明文并支持自动迁移）。

独立成模块（不依赖 strawberry / ORM），供视图层与建表播种共同使用。
"""
from __future__ import annotations

import hashlib
import secrets

PBKDF2_ITERATIONS = 100_000

# 用于抹平「用户不存在」与「密码错误」的响应时间差，防用户名枚举
DUMMY_HASH = "pbkdf2$" + "00" * 16 + "$" + "00" * 32


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${salt.hex()}${digest.hex()}"


def check_password(stored: str, password: str) -> tuple[bool, str | None]:
    """返回 (是否匹配, 需要回写的新哈希)。旧明文记录验证通过后返回新哈希以自动迁移。"""
    if stored.startswith("pbkdf2$"):
        try:
            _, salt_hex, digest_hex = stored.split("$", 2)
            calc = hashlib.pbkdf2_hmac(
                "sha256", password.encode(), bytes.fromhex(salt_hex), PBKDF2_ITERATIONS
            )
            return secrets.compare_digest(calc.hex(), digest_hex), None
        except (ValueError, TypeError):
            return False, None
    if stored == password:  # 历史明文兼容
        return True, hash_password(password)
    return False, None
