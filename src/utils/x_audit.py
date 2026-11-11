"""审计日志模块：追踪记录每个用户的操作行为，按天轮转。

设计要点：
- 独立文件 logs/id_x_007_audit.log，与引擎 info/warn/error 日志隔离；
- JSON Lines 格式（单行一条），便于 grep 与后续接入看板：
    {"ts","rid","action","result","user_id","username","role","target","detail","ip"}
- TimedRotatingFileHandler(when="midnight")：每日 0 点轮转为
    id_x_007_audit.log.2026-11-06，过期文件自动清理；
- 保留天数：固定 14 天，过期轮转文件自动清理；
- 写入失败绝不影响业务（静默降级到引擎 logger 提示一次）；
- 用户对象采用鸭子类型（PaUser/None 均可），与 ORM 解耦。
"""
from __future__ import annotations

import json
import logging
import os
import threading
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime
from pathlib import Path
from typing import Any

from utils.log_util import logger, request_id_var

_logger_name = "id_x_007.audit"
_lock = threading.Lock()
_handler: logging.Handler | None = None
_fallback_warned = False


def _default_log_dir() -> Path:
    """日志目录：PROJECT_PATH/logs（容器注入），回退到仓库根/logs（本地开发）。"""
    pp = os.environ.get("PROJECT_PATH")
    if pp:
        return Path(pp) / "logs"
    # 本文件位于 <repo>/x_models/id_x_007/src/utils/ -> parents[4] 为仓库根
    return Path(__file__).resolve().parents[4] / "logs"


# 审计日志保留天数（固定值，过期轮转文件由 handler 自动清理）
AUDIT_RETAIN_DAYS = 14


def _build_handler() -> logging.Handler:
    log_dir = _default_log_dir()
    log_dir.mkdir(parents=True, exist_ok=True)
    handler = TimedRotatingFileHandler(
        log_dir / "id_x_007_audit.log",
        when="midnight",          # 每日 0 点轮转
        backupCount=AUDIT_RETAIN_DAYS,  # 过期自动清理
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    return handler


def _get_logger() -> logging.Logger:
    """懒加载单例 logger（首次调用初始化 handler，进程内复用）。"""
    global _handler
    lg = logging.getLogger(_logger_name)
    if _handler is None:
        with _lock:
            if _handler is None:
                _handler = _build_handler()
                lg.addHandler(_handler)
                lg.setLevel(logging.INFO)
                lg.propagate = False  # 不向引擎 root logger 重复输出
    return lg


def _client_ip(info: Any) -> str:
    """尽力提取客户端 IP（HAProxy 反代时取 X-Forwarded-For 首段）。"""
    try:
        ctx = info.context
        request = ctx.get("request") if isinstance(ctx, dict) else getattr(ctx, "request", None)
        if request is None:
            return ""
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
        client = getattr(request, "client", None)
        return getattr(client, "host", "") or ""
    except Exception:
        return ""


def audit(
    action: str,
    user: Any = None,
    *,
    target: str = "",
    detail: Any = "",
    result: str = "ok",
    info: Any = None,
    username: str = "",
) -> None:
    """记录一条用户操作审计日志（任何异常均静默，不影响业务）。

    参数：
    - action:  操作名，模块.动词（如 auth.login / slot.create / export.appointments）
    - user:    PaUser 对象（取 id/username/role）；匿名操作传 None 并可用 username 补充
    - target:  操作对象标识（如 预约单号 A12345678 / slot#12）
    - detail:  补充信息（任意可 JSON 序列化对象）
    - result:  ok / fail / denied
    - info:    GraphQL Info（可选，用于提取客户端 IP）
    """
    global _fallback_warned
    try:
        entry = {
            "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "rid": request_id_var.get(),
            "action": action,
            "result": result,
            "user_id": getattr(user, "id", None),
            "username": getattr(user, "username", None) or username,
            "role": getattr(user, "role", None),
            "target": str(target or ""),
            "detail": detail,
            "ip": _client_ip(info) if info is not None else "",
        }
        _get_logger().info(json.dumps(entry, ensure_ascii=False, default=str))
    except Exception as e:  # 审计绝不阻断业务；失败仅经引擎 logger 提示一次
        if not _fallback_warned:
            _fallback_warned = True
            logger.warning(f"审计日志写入失败（后续降级为仅控制台提示）: {e}")
