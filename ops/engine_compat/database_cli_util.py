# -*- coding: utf-8 -*-
# id_x_007 容器部署版（ops/engine_compat）：镜像构建时覆盖宿主的 DM8 实现，
# 对外接口（DatabaseClient / load_module_db_config / build_module_db_clients）保持不变，
# 连接串改为 PostgreSQL。
# 与宿主契约一致：async_config 必须返回 SQLAlchemyAsyncConfig（asyncpg 异步引擎）——
# main.py 的 _startup_module_db 以 `async with engine.connect()` 探活，
# x_plugin.set_session_maker 也从异步引擎 URL 派生 psycopg2 同步引擎；
# 若返回同步配置会在启动时抛 AttributeError: __aenter__。
import os
from urllib.parse import quote_plus

# 注意：必须使用 advanced_alchemy.extensions.litestar 下的插件配置类，
# 它提供 engine_app_state_key / session_maker_app_state_key
# / engine_dependency_key / session_dependency_key 等关键字参数。
# 切勿改用 advanced_alchemy.config 下的裸配置基类——不接受上述参数，
# 会抛 TypeError: ... got an unexpected keyword argument 'engine_app_state_key'。
# 同理 EngineConfig / SQLAlchemyPlugin 也从 advanced_alchemy.extensions.litestar
# 引入：litestar.plugins.sqlalchemy 自 litestar 2.18 起已弃用，3.0 将移除。
from advanced_alchemy.config.asyncio import AsyncSessionConfig
from advanced_alchemy.extensions.litestar import (
    EngineConfig,
    SQLAlchemyAsyncConfig,
    SQLAlchemyPlugin,
)
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from dotenv import dotenv_values

from .config_parse_util import load_toml_config
from .decrypt_util import decrypt
from .env_loader import PROJECT_ROOT, load_env_hierarchy
from .log_util import logger

_BASE_CONFIG = load_toml_config("base_config.toml")

load_env_hierarchy(_BASE_CONFIG)

POOL_DEFAULTS: dict = {
    "pool_size": 10,
    "max_overflow": 20,
    "pool_recycle": 300,
    "pool_pre_ping": True,
    "pool_timeout": 10,
}

DB_CONFIG_KEYS = ("DB_NAME", "DB_HOST", "DB_PORT", "DB_USERNAME", "DB_PASSWORD")

# 模块 .env 中以加密值存储的键（utils/encrypt_util.py 生成），DB_NAME 保持明文
DB_ENCRYPTED_KEYS = ("DB_HOST", "DB_PORT", "DB_USERNAME", "DB_PASSWORD")


def _decrypt_safe(value: str | None) -> str:
    """对可能为加密值或明文的字符串做安全解密。

    上一代实现用「解密结果是否可打印」判断是否为密文，但对短明文（如 ``SYSDBA``）
    偶然解出可打印乱码（``+Ӻr``），会把正确的明文配置破坏掉。

    本实现改用「往返一致性」判别：真正的密文 C = encrypt(P) 满足
    encrypt(decrypt(C)) == C（往返还原）；而明文 P 经 decrypt 得到乱码 G，
    encrypt(G) 几乎不可能等于 P，故不会误判。这样 ``.env`` 中既可写密文
    （encrypt_util.py 产出），也可写明文（如容器注入 ``DB_HOST=db`` 或
    迁移期直接填写 ``DB_USERNAME=SYSDBA``），两者都能正确解析。
    """
    if value is None or value == "":
        return value  # type: ignore[return-value]
    try:
        from .encrypt_util import encrypt  # 延迟导入，避免循环依赖

        decrypted = decrypt(value)
    except Exception:
        return value
    # 往返一致才认定是密文，否则按明文原样返回
    try:
        if encrypt(decrypted) == value.strip():
            return decrypted
    except Exception:
        pass
    return value


class DatabaseClient:
    """模块业务库客户端（PostgreSQL，容器部署版）。

    连接参数解析顺序（高 → 低）：
    1. 模块自身 .env（db_config 传入，加密值已解密，模块间相互隔离）
    2. 全局环境变量（容器注入等部署方式，明文或加密值均可，
       加密值由 utils/encrypt_util.py 生成）
    """

    def __init__(
        self,
        db_name: str | None = None,
        db_config: dict[str, str | None] | None = None,
    ):
        config = db_config or {}
        self.db_name = db_name or config.get("DB_NAME") or os.getenv("DB_NAME")
        self.db_host = self._resolve("DB_HOST", config)
        self.db_port = self._resolve("DB_PORT", config)
        self.db_username = self._resolve("DB_USERNAME", config)
        self.db_password = self._resolve("DB_PASSWORD", config)

    @staticmethod
    def _resolve(key: str, config: dict[str, str | None]) -> str | None:
        value = config.get(key)
        if value is not None:
            return value
        env_value = os.getenv(key)
        if env_value is None:
            return None
        return _decrypt_safe(env_value)

    @property
    def _db_name(self) -> str:
        assert self.db_name is not None
        return self.db_name

    @property
    def _db_host(self) -> str:
        assert self.db_host is not None
        return self.db_host

    @property
    def _db_port(self) -> str:
        assert self.db_port is not None
        return self.db_port

    @property
    def _db_username(self) -> str:
        assert self.db_username is not None
        return self.db_username

    @property
    def _db_password(self) -> str:
        assert self.db_password is not None
        return self.db_password

    @property
    def sync_conn_string(self) -> str:
        """PostgreSQL 连接串（psycopg2 驱动，同步模式）。"""
        self._validate()
        return (
            f"postgresql+psycopg2://{quote_plus(self._db_username)}:{quote_plus(self._db_password)}"
            f"@{self._db_host}:{self._db_port}/{self._db_name}"
        )

    @property
    def async_conn_string(self) -> str:
        """PostgreSQL 连接串（asyncpg 驱动，异步模式，与宿主一致）。"""
        self._validate()
        return (
            f"postgresql+asyncpg://{quote_plus(self._db_username)}:{quote_plus(self._db_password)}"
            f"@{self._db_host}:{self._db_port}/{self._db_name}"
        )

    def db_config(self):
        self._validate()
        return {
            "SQLALCHEMY_TRACK_MODIFICATIONS": True,
            "CONN_STRING": self.sync_conn_string,
            "ASYNC_CONN_STRING": self.async_conn_string,
            "DATABASE": {
                "host": self._db_host,
                "port": self._db_port,
                "database": self._db_name,
                "user": self._db_username,
                "password": self._db_password,
            },
        }

    def db_engine(self):
        return scoped_session(
            sessionmaker(
                bind=create_engine(
                    self.sync_conn_string,
                    **POOL_DEFAULTS,
                )
            )
        )

    def async_config(self, name: str = "db", metadata=None):
        """返回异步 SQLAlchemy 配置（asyncpg，与宿主契约一致）。"""
        config = SQLAlchemyAsyncConfig(
            connection_string=self.async_conn_string,
            metadata=metadata,
            engine_config=EngineConfig(**POOL_DEFAULTS),
            session_config=AsyncSessionConfig(expire_on_commit=False),
            engine_app_state_key=f"{name}_engine",
            session_maker_app_state_key=f"{name}_session_maker",
            engine_dependency_key=f"{name}_db_engine",
            session_dependency_key=f"{name}_db_session",
        )
        return config, SQLAlchemyPlugin(config=config)

    def _validate(self):
        if not all(
            [
                self.db_name,
                self.db_host,
                self.db_port,
                self.db_username,
                self.db_password,
            ]
        ):
            missing = [
                name
                for name, val in [
                    ("DB_NAME", self.db_name),
                    ("DB_HOST", self.db_host),
                    ("DB_PORT", self.db_port),
                    ("DB_USERNAME", self.db_username),
                    ("DB_PASSWORD", self.db_password),
                ]
                if val is None
            ]
            raise ValueError(
                f"Missing required database configuration: {', '.join(missing)}"
            )


def load_module_db_config(model_path: str) -> dict[str, str | None]:
    """从模块自身 .env 文件解析业务库配置。

    DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD 以加密值存储
    （utils/encrypt_util.py 生成），此处解密；DB_NAME 为明文。
    直接解析文件而非读取全局环境，保证 x_models 下各子模块的
    数据库连接互不影响；缺失的键由 DatabaseClient 回落到全局环境变量。
    """
    env_file = PROJECT_ROOT / "x_models" / model_path / ".env"
    if not env_file.exists():
        logger.warning(
            f"模块 {model_path} 无 .env 文件，数据库配置将回落到全局环境变量: {env_file}"
        )
        return {}
    values = dotenv_values(env_file)
    config: dict[str, str | None] = {}
    for key in DB_CONFIG_KEYS:
        value = values.get(key)
        if not value:
            config[key] = None
        elif key in DB_ENCRYPTED_KEYS:
            config[key] = _decrypt_safe(value)
        else:
            config[key] = value
    return config


def build_module_db_clients(base_config: dict) -> dict[str, "DatabaseClient"]:
    """按 [EXTEND].MODELS 注册顺序，为每个子模块构建独立的数据库客户端。

    返回的 dict 以模块名（路由前缀对应的 model_path）为键，
    业务请求命中 /b<route_prefix> 路由时，由对应插件使用各自的连接。
    """
    clients: dict[str, DatabaseClient] = {}
    for model_path, _route_prefix in base_config.get("EXTEND", {}).get("MODELS", []):
        clients[model_path] = DatabaseClient(
            db_config=load_module_db_config(model_path)
        )
    return clients
