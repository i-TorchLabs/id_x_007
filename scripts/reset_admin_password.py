"""重置（或创建）admin 账号密码的运维脚本。

使用场景：管理员忘记密码 / 初始化后需要改掉默认口令。

行为：
- 读取 ops/.env 中的 POSTGRES_* 配置，psycopg2 直连数据库（默认宿主机映射端口 55432）；
- 将目标账号密码更新为 PBKDF2-HMAC-SHA256 哈希（与后端 x_security 同格式）；
- 同时清空会话 key（置 N/A），强制该账号重新登录；
- 账号不存在时创建一个 admin 角色账号。

用法：
    python3 reset_admin_password.py                     # 交互输入新密码，默认账号取 ops/.env 的 PA_ADMIN_USERNAME
    python3 reset_admin_password.py --username admin    # 指定账号
    PA_DB_HOST=127.0.0.1 PA_DB_PORT=55432 python3 reset_admin_password.py
"""
from __future__ import annotations

import argparse
import getpass
import hashlib
import os
import secrets
import sys
from pathlib import Path

import psycopg2

PBKDF2_ITERATIONS = 100_000  # 与 src/utils/x_security.py 保持一致


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${salt.hex()}${digest.hex()}"


def load_env_file(path: Path) -> dict[str, str]:
    """极简 .env 解析：KEY=VALUE，忽略注释与空行，不做引号展开。"""
    result: dict[str, str] = {}
    if not path.exists():
        return result
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        result[key.strip()] = value.strip()
    return result


def main() -> int:
    env = load_env_file(Path(__file__).resolve().parent.parent / "ops" / ".env")

    parser = argparse.ArgumentParser(description="Reset (or create) an admin account password.")
    parser.add_argument(
        "--username",
        default=env.get("PA_ADMIN_USERNAME", "") or "admin",
        help="target username (default: PA_ADMIN_USERNAME from ops/.env, else admin)",
    )
    args = parser.parse_args()

    host = os.environ.get("PA_DB_HOST", "127.0.0.1")
    port = int(os.environ.get("PA_DB_PORT", "55432"))
    dbname = env.get("POSTGRES_DB", "id_x_007")
    user = env.get("POSTGRES_USER", "postgres")
    password = env.get("POSTGRES_PASSWORD", "postgres")

    new_password = getpass.getpass("New password (>= 6 chars): ")
    if len(new_password) < 6:
        print("Error: password requires at least 6 characters.")
        return 1
    if getpass.getpass("Confirm password: ") != new_password:
        print("Error: passwords do not match.")
        return 1

    hashed = hash_password(new_password)
    conn = psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=password)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE pa_user SET password = %s, key = 'N/A' WHERE username = %s",
                (hashed, args.username),
            )
            if cur.rowcount == 0:
                cur.execute(
                    "INSERT INTO pa_user (username, password, key, role, name, email, state,"
                    " create_time, update_time)"
                    " VALUES (%s, %s, 'N/A', 'admin', 'Administrator', 'N/A', '1', NOW(), NOW())",
                    (args.username, hashed),
                )
                print(f"Account '{args.username}' not found; created a new admin account.")
            else:
                print(f"Password of '{args.username}' has been reset; existing session invalidated.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
