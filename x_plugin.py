# -*- coding: utf-8 -*-

from __future__ import annotations

from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker

from x_models._contracts import PluginInterface


class _Idx007Plugin:
    """id_x_007 插件实现（UGO 朋辈顾问咨询预约系统），懒加载内部模块。

    适配宿主框架的异步契约（PluginInterface：async build_tables / async_sessionmaker）。
    模块内部（views/models）为同步 Session 风格，因此本适配层做两处桥接：
    - build_tables：经 AsyncConnection.run_sync 调用同步的 create_all 与播种函数；
    - set_session_maker：从宿主异步引擎（asyncpg）的 URL 派生 psycopg2 同步引擎，
      构造同步 sessionmaker 注入模块（容器部署则由 ops/engine_compat 全局走同步，
      不经过此桥接）；注入成功后启动每日 21:00 的预约提醒调度器
      （无运行中事件循环 / PA_SCHEDULER_DISABLED=1 时自动跳过）。
    """

    name = "id_x_007"

    def __init__(self) -> None:
        self._base: Any = None
        self._sync_engine: Any = None

    @property
    def base(self) -> Any:
        if self._base is None:
            from x_models.id_x_007.src.models.x_models import Base
            self._base = Base
        return self._base

    @property
    def required_extensions(self) -> tuple[str, ...]:
        return ()

    def set_session_maker(self, maker: async_sessionmaker[AsyncSession]) -> None:
        from x_models.id_x_007.src.models.x_models import set_session_maker

        async_engine = maker.kw.get("bind")
        if async_engine is None:
            raise RuntimeError("async_sessionmaker 未绑定引擎，无法派生同步会话工厂")
        sync_url = async_engine.url.set(drivername="postgresql+psycopg2")
        self._sync_engine = create_engine(
            sync_url,
            pool_size=10,
            max_overflow=20,
            pool_recycle=300,
            pool_pre_ping=True,
            pool_timeout=10,
        )
        set_session_maker(sessionmaker(bind=self._sync_engine, expire_on_commit=False))

        # 会话工厂就绪后启动预约提醒调度器（内部自判事件循环与开关）
        from x_models.id_x_007.src.utils.x_scheduler import start_scheduler
        start_scheduler()

    async def build_tables(self, conn: AsyncConnection) -> None:
        await conn.run_sync(self.base.metadata.create_all)
        # 建表后播种初始管理员与默认邮件模板（均幂等）
        from x_models.id_x_007.src.models.x_models import (
            seed_default_mail_templates,
            seed_initial_admin,
        )
        await conn.run_sync(seed_initial_admin)
        await conn.run_sync(seed_default_mail_templates)


def load_plugin() -> PluginInterface:
    return _Idx007Plugin()
