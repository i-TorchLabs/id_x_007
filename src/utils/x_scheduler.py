"""定时调度：每天 21:00（Asia/Shanghai）扫描次日预约并发送提醒邮件。

实现要点：
- asyncio 后台任务：计算到下一个 21:00 的秒数后 sleep，到点执行再循环；
- 多 worker 防重：执行前先取 PostgreSQL 会话级咨询锁
  pg_try_advisory_lock(775200721)，拿不到锁说明其他 worker 正在/已经发送，直接跳过；
- 业务逻辑为同步 Session（与 views 同范式），经 asyncio.to_thread 跑在线程池中，
  不阻塞事件循环；
- 环境变量 PA_SCHEDULER_DISABLED=1 可整体关闭（如多实例部署时只保留一个实例开启）。
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, text

from utils.log_util import logger

from x_models.id_x_007.src.models.x_models import (
    PaAdvisor,
    PaAppointment,
    PaSlot,
    PaUser,
    get_session,
)
from x_models.id_x_007.src.utils.x_mail import render_mail, send_mail

# 咨询锁 ID：本模块专用，防多 worker 重复发送
SCHEDULER_LOCK_ID = 775200721
# 每日执行时刻（Asia/Shanghai）
RUN_HOUR = 21
_TZ = ZoneInfo("Asia/Shanghai")

_task: asyncio.Task | None = None


def _seconds_until_next_run() -> float:
    """距下一个 Asia/Shanghai 21:00 的秒数（恒为正）。"""
    now = datetime.now(_TZ)
    next_run = now.replace(hour=RUN_HOUR, minute=0, second=0, microsecond=0)
    if next_run <= now:
        next_run += timedelta(days=1)
    return max((next_run - now).total_seconds(), 1.0)


def _fmt(dt: datetime | None) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else ""


def _send_tomorrow_reminders() -> None:
    """扫描次日（次日 00:00–24:00）state=booked 的预约，给学生与顾问各发提醒邮件。

    同步实现（由 asyncio.to_thread 调用）。库内时间为 Asia/Shanghai 本地 naive 时间
    （进程时区已在 views 导入期锚定），故窗口直接按本地日期计算。
    """
    maker = get_session()
    with maker() as session:
        # 会话级咨询锁：同一时刻只允许一个 worker 执行发送
        got = session.execute(
            text("SELECT pg_try_advisory_lock(:lid)"), {"lid": SCHEDULER_LOCK_ID}
        ).scalar()
        if not got:
            logger.info("提醒调度：未取得咨询锁（其他 worker 正在执行），跳过本轮")
            return
        try:
            tomorrow = datetime.now(_TZ).date() + timedelta(days=1)
            window_start = datetime(tomorrow.year, tomorrow.month, tomorrow.day)
            window_end = window_start + timedelta(days=1)
            rows = session.execute(
                select(PaAppointment, PaSlot)
                .join(PaSlot, PaAppointment.slot_id == PaSlot.id)
                .where(
                    PaAppointment.state == "booked",
                    PaSlot.start_time >= window_start,
                    PaSlot.start_time < window_end,
                )
                .order_by(PaSlot.start_time)
            ).all()
            logger.info(f"提醒调度：次日 {tomorrow} 共 {len(rows)} 条有效预约")
            for appt, slot in rows:
                advisor = session.execute(
                    select(PaAdvisor).where(PaAdvisor.id == appt.advisor_id)
                ).scalars().first()
                advisor_name = advisor.name if advisor else "N/A"
                student = session.execute(
                    select(PaUser).where(PaUser.id == appt.student_user_id)
                ).scalars().first()
                advisor_user = session.execute(
                    select(PaUser).where(PaUser.id == advisor.user_id)
                ).scalars().first() if advisor else None
                # 主题与正文经 pa_mail_template 渲染（管理员可配置），缺失回退内置默认
                subject, content = render_mail(session, "reminder", {
                    "intro": "您有一条明日的朋辈咨询预约，请准时参加：",
                    "apply_no": appt.apply_no,
                    "advisor_name": advisor_name,
                    "student_name": appt.student_name,
                    "student_no": appt.student_no,
                    "start_time": _fmt(slot.start_time),
                    "end_time": _fmt(slot.end_time),
                    "topic": appt.topic,
                    "mode": "线上" if appt.mode == "online" else "线下",
                    "extra": "",
                })
                if student:
                    send_mail(session, student.email, "reminder", subject, content, appt.id)
                if advisor_user:
                    send_mail(session, advisor_user.email, "reminder", subject, content, appt.id)
            session.commit()
        except Exception as e:
            logger.error(f"提醒调度执行失败: {e}")
            session.rollback()
        finally:
            # 释放咨询锁（会话级锁随连接归还也会释放，此处显式释放更稳妥）
            try:
                session.execute(
                    text("SELECT pg_advisory_unlock(:lid)"), {"lid": SCHEDULER_LOCK_ID}
                )
                session.commit()
            except Exception:
                pass


async def _scheduler_loop() -> None:
    """后台循环：sleep 到下一个 21:00 → 线程池执行发送 → 继续下一轮。"""
    logger.info("提醒调度器已启动（每日 21:00 Asia/Shanghai 发送次日预约提醒）")
    while True:
        try:
            await asyncio.sleep(_seconds_until_next_run())
            await asyncio.to_thread(_send_tomorrow_reminders)
        except asyncio.CancelledError:
            logger.info("提醒调度器已停止")
            raise
        except Exception as e:
            # 单轮异常不终止调度循环
            logger.error(f"提醒调度循环异常: {e}")
            await asyncio.sleep(60)


def start_scheduler() -> None:
    """启动后台调度任务（幂等）。

    - PA_SCHEDULER_DISABLED=1 时不启动；
    - 当前线程无运行中事件循环（如同步脚本 / 容器全局同步部署）时静默跳过。
    """
    global _task
    if os.environ.get("PA_SCHEDULER_DISABLED", "") == "1":
        logger.info("提醒调度器已禁用（PA_SCHEDULER_DISABLED=1）")
        return
    if _task is not None and not _task.done():
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.info("当前无运行中事件循环，跳过提醒调度器启动")
        return
    _task = loop.create_task(_scheduler_loop())
