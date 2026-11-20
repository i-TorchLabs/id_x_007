"""数据层：ORM 模型 + Base + 全局会话工厂（引擎启动时注入）。

UGO 咨询预约系统（id_x_007），表前缀 pa_：
- pa_user        用户账号（admin / advisor / student，student/advisor 仅可 SSO 登录）
- pa_advisor     档案（独立建档不落 pa_user，SSO 登录按邮箱匹配档案确定顾问身份，
                 邮箱即登录账号（唯一），含擅长方向 / 简介 / 照片）
- pa_advisor_allow 顾问 SSO 登录白名单（email + allow，仅校验顾问：不在名单或 allow=False 的顾问邮箱拒绝 SSO 登录，学生不受限）
- pa_slot_def    固定时段定义（slot-01 ~ slot-24，30 分钟粒度，ops/init/05_slot.sql 预置）
- pa_slot        周排期（顾问 × 星期几 × 时段定义，按自然周滚动生效，不落具体日期）
- pa_slot_cancel 周排期跳过记录（「取消本次」后该日期不再放出可约）
- pa_appointment 预约记录（预约单号 A+8 位数字；快照预约日期与起止时间）
- pa_feedback    咨询反馈（与预约一一对应，仅管理员和顾问本人可见）
- pa_email_log   邮件发送日志（booked_student / booked_advisor / reminder / cancelled）
- pa_mail_template 邮件模板（库表驱动，管理员可配置文案，缺失时代码内回退默认）
- pa_sso_settings SSO 单点登录配置（取代 .env 的 PA_OAUTH_* 配置，取 id 最小行生效）
- pa_smtp_settings SMTP 邮件配置（取代 .env 的 PA_SMTP_* 配置，取 id 最小行生效）
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import (
    Boolean,
    Connection,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    insert,
    select,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


_session_maker: sessionmaker[Session] | None = None


def set_session_maker(maker: sessionmaker[Session]) -> None:
    global _session_maker
    _session_maker = maker


def get_session() -> sessionmaker[Session]:
    if _session_maker is None:
        raise RuntimeError("session_maker 未注入，请确认引擎已完成插件初始化")
    return _session_maker


# ==========================================
# SSO 配置缓存，由 views.load_oauth_config() 从 pa_sso_settings 表读取后注入
# （参考 id_x_010 的 sso_settings 实现）
# ==========================================
_oauth_config: dict | None = None


def set_oauth_config(config: dict | None) -> None:
    """由 views 层调用，将 pa_sso_settings 表读取结果注入全局缓存。"""
    global _oauth_config
    _oauth_config = config


def get_oauth_config() -> dict | None:
    """获取 SSO 配置缓存，供 view_oauth_login 同步读取。"""
    return _oauth_config


# ===== 业务模型区（UGO 咨询预约系统） =====


class PaUser(Base):
    __tablename__ = "pa_user"
    __table_args__ = {"comment": "用户表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    username: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", unique=True, comment="用户名（SSO 用户为 upn/邮箱）")
    password: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="密码（PBKDF2 哈希，SSO 用户为 N/A）")
    key: Mapped[str] = mapped_column(Text, nullable=False, default="N/A", comment="会话密钥（Token）")
    role: Mapped[str] = mapped_column(String(255), nullable=False, default="student", comment="角色(student/advisor/admin)")
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="姓名")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="邮箱")
    state: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="状态(1启用/0停用)")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, comment="是否已激活（自助注册的 admin 默认 False，须运维登库置 True 后方可登录）")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaAdvisor(Base):
    __tablename__ = "pa_advisor"
    __table_args__ = {"comment": "档案表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="姓名")
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True,
        comment="邮箱（同时是登录账号：SSO 登录按此匹配顾问身份，唯一）",
    )
    grade: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="年级")
    major: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="专业")
    direction: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="擅长方向")
    bio: Mapped[str] = mapped_column(Text, nullable=False, default="N/A", comment="个人简介")
    photo: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="照片（base64 data URL）")
    status: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="状态(1启用/0停用)")
    accepting: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="接待状态(1接待/0暂不接待)")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaAdvisorAllow(Base):
    __tablename__ = "pa_advisor_allow"
    __table_args__ = {"comment": "顾问 SSO 登录白名单表（仅顾问受限，学生不校验）"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, comment="邮箱地址（匹配 SSO 声明的 email/upn，大小写不敏感）")
    allow: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, comment="允许（False 时等同不在白名单）")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaSlotDef(Base):
    """固定时段定义表（slot-01 ~ slot-24，每段 30 分钟）。

    「时段管理」不再让顾问/管理员手填任意起止时间，而是从这里选择；
    定义由 ops/init/05_slot.sql 预置，应用启动时幂等播种，运行期可改表。
    """

    __tablename__ = "pa_slot_def"
    __table_args__ = {"comment": "固定时段定义表（30 分钟粒度）"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, comment="时段编码（slot-01 ~ slot-24）")
    start_clock: Mapped[str] = mapped_column(String(5), nullable=False, comment="开始时刻（HH:MM）")
    end_clock: Mapped[str] = mapped_column(String(5), nullable=False, comment="结束时刻（HH:MM）")
    sort_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="排序号")
    state: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="状态(1启用/0停用)")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaSlot(Base):
    """周排期表：顾问 × 星期几 × 固定时段，按周自动循环生效。

    一周从星期一开始（weekday: 1=周一 ... 7=周日），不存具体日期；
    每次展示/预约时按自然周滚动计算「下一次」occurrence，因此无需定时
    任务轮转数据，已约数量也随周次自动清零。
    """

    __tablename__ = "pa_slot"
    __table_args__ = (
        UniqueConstraint("advisor_id", "weekday", "slot_def_id", name="pa_slot_uniq_weekly"),
        {"comment": "周排期表（按星期循环）"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    advisor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_advisor.id"), nullable=False, comment="顾问ID"
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False, comment="星期几（1周一...7周日）")
    slot_def_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_slot_def.id"), nullable=False, comment="时段定义ID"
    )
    state: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="状态(1开放/0暂停)")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaSlotCancel(Base):
    """周排期「跳过某一次」记录：顾问取消本周时段后，该日期不再可约。

    周排期序列本身保留；每次展示/预约时若计算出的 occurrence 落在本表中，
    自动顺延一周，因此取消只影响当次，也不会让同一日期被重新放出。
    """

    __tablename__ = "pa_slot_cancel"
    __table_args__ = (
        UniqueConstraint("slot_id", "occur_date", name="pa_slot_cancel_uniq"),
        {"comment": "周排期跳过记录表"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    slot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_slot.id", ondelete="CASCADE"), nullable=False, comment="周排期ID"
    )
    occur_date: Mapped[date] = mapped_column(Date, nullable=False, comment="被跳过的日期")
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="取消原因")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")


class PaAppointment(Base):
    __tablename__ = "pa_appointment"
    __table_args__ = {"comment": "预约记录表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    apply_no: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, comment="预约单号（A+8位数字）")
    slot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_slot.id"), nullable=False, comment="周排期ID"
    )
    book_date: Mapped[date] = mapped_column(Date, nullable=False, comment="预约日期（具体某一周的第几天）")
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="开始时间（预约日期+时段定义，落库快照）")
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="结束时间（预约日期+时段定义，落库快照）")
    advisor_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="顾问ID")
    student_user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="学生用户ID")
    student_name: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="学生姓名")
    student_no: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="学号")
    topic: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="咨询主题")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="N/A", comment="咨询内容")
    mode: Mapped[str] = mapped_column(String(255), nullable=False, default="online", comment="咨询方式(online线上/offline线下)")
    phone: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="电话")
    wechat: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="微信号（线上必填/线下选填）")
    meeting_link: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="会议链接（线上选填）")
    state: Mapped[str] = mapped_column(
        String(255), nullable=False, default="booked",
        comment="状态(booked已预约/cancelled_student学生取消/cancelled_advisor顾问取消/completed已完成)",
    )
    cancel_reason: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="取消原因（顾问取消时必填）")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaFeedback(Base):
    __tablename__ = "pa_feedback"
    __table_args__ = {"comment": "咨询反馈表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    appointment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_appointment.id"), nullable=False, unique=True, comment="预约ID"
    )
    advisor_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="顾问ID")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="咨询总结")
    handle: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="处理方式")
    need_followup: Mapped[str] = mapped_column(String(255), nullable=False, default="0", comment="是否需要跟进(1是/0否)")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaEmailLog(Base):
    __tablename__ = "pa_email_log"
    __table_args__ = {"comment": "邮件发送日志表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    mail_to: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="收件人")
    mail_type: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="邮件类型(booked_student预约成功确认/booked_advisor新预约通知/reminder次日提醒/cancelled取消预约·学生/cancelled_advisor顾问取消时段通知)")
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="主题")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="正文")
    status: Mapped[str] = mapped_column(String(255), nullable=False, default="skipped", comment="状态(sent已发送/failed失败/skipped未配置跳过)")
    error: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="错误信息")
    appointment_id: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="关联预约ID")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")


class PaMailTemplate(Base):
    __tablename__ = "pa_mail_template"
    __table_args__ = {"comment": "邮件模板表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    mail_type: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, comment="邮件类型(booked_student预约成功确认/booked_advisor新预约通知/reminder次日提醒/cancelled取消预约·学生/cancelled_advisor顾问取消时段通知)")
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="主题模板（支持 {apply_no} 等占位符）")
    html: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="正文 HTML 模板（支持 {apply_no} 等占位符）")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaSsoSettings(Base):
    """SSO 单点登录配置（取 id 最小行作为当前生效配置）。

    参考 id_x_010 的 sso_settings：取代原 .env 的 PA_OAUTH_CLIENT_ID /
    PA_OAUTH_CLIENT_SECRET / PA_OAUTH_REDIRECT_URI 配置项；由 views 层
    读入缓存。client_secret 仅服务端持有，绝不进入前端代码。
    """

    __tablename__ = "pa_sso_settings"
    __table_args__ = {"comment": "SSO 单点登录配置表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, comment="ADFS 分配的 Client ID")
    client_secret: Mapped[str] = mapped_column(String(256), nullable=False, comment="ADFS 共享秘钥（明文，仅服务端持有）")
    redirect_uri: Mapped[str] = mapped_column(String(256), nullable=False, comment="OAuth2 回调地址（须与 ADFS 注册一致）")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaSmtpSettings(Base):
    """SMTP 邮件配置（取 id 最小行作为当前生效配置）。

    取代原 .env 的 PA_SMTP_HOST / PA_SMTP_PORT / PA_SMTP_USER /
    PA_SMTP_PASSWORD / PA_MAIL_FROM 配置项；x_mail 发信时实时读表，
    运行期改表即生效。host / username / password 任一为空视为未配置，
    发送降级为 skipped 落库。
    """

    __tablename__ = "pa_smtp_settings"
    __table_args__ = {"comment": "SMTP 邮件配置表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    host: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="SMTP 服务器地址")
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=587, comment="SMTP 端口（默认 587 STARTTLS）")
    username: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="SMTP 登录账号")
    password: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="SMTP 登录口令（仅服务端持有）")
    mail_from: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="发件人地址（空则取 username）")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


def seed_slot_defs(conn: Connection) -> None:
    """从 ops/init/05_slot.sql 幂等播种 24 个固定时段定义。

    时段定义不写死在代码里：SQL 文件是唯一的事实来源，应用启动时按语句
    顺序执行（每条 INSERT ... ON CONFLICT (code) DO UPDATE），
    因此调整时刻只需改 SQL 并重启，或在库中直接 UPDATE pa_slot_def。
    """
    path = Path(__file__).resolve().parents[2] / "ops" / "init" / "05_slot.sql"
    if not path.is_file():
        logger.warning(f"未找到时段定义 SQL（{path}），跳过播种")
        return
    lines = [
        line for line in path.read_text(encoding="utf-8").splitlines()
        if not line.strip().startswith("--")
    ]
    for stmt in " ".join(lines).split(";"):
        if stmt.strip():
            conn.execute(text(stmt))


def _table_columns(conn: Connection, table: str) -> set[str]:
    rows = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = current_schema() AND table_name = :t"
    ), {"t": table}).all()
    return {row[0] for row in rows}


def migrate_slots_to_weekly(conn: Connection) -> None:
    """把旧版「绝对日期」排期迁移为「星期 + 固定时段」周排期（幂等）。

    旧模型 pa_slot(start_time, end_time, booked) 每条记录只覆盖某一天；
    新模型 pa_slot(weekday, slot_def_id) 每周自动循环。迁移步骤：
    1. 先把每条预约的起止时间/预约日期从旧时段快照到 pa_appointment，
       历史数据不再依赖排期表（排期改时段也不影响历史）；
    2. 旧排期按 (顾问, 星期几, 起止时刻) 归并到对应 pa_slot_def：
       命中 24 个标准时段的复用，非标的补一条 legacy-* 定义以保留外键；
       同一周同时段的多条旧记录合并为一条，预约记录重指向保留行；
    3. 删除旧列 start_time/end_time/booked，补唯一索引与 NOT NULL。
    新库（无 start_time 列）直接跳过。
    """
    slot_cols = _table_columns(conn, "pa_slot")
    if not slot_cols or "start_time" not in slot_cols:
        return
    logger.info("检测到旧版日期排期结构，开始迁移为周排期")

    conn.execute(text("ALTER TABLE pa_slot ADD COLUMN IF NOT EXISTS weekday INTEGER"))
    conn.execute(text("ALTER TABLE pa_slot ADD COLUMN IF NOT EXISTS slot_def_id INTEGER"))
    conn.execute(text("ALTER TABLE pa_appointment ADD COLUMN IF NOT EXISTS book_date DATE"))
    conn.execute(text("ALTER TABLE pa_appointment ADD COLUMN IF NOT EXISTS start_time TIMESTAMP"))
    conn.execute(text("ALTER TABLE pa_appointment ADD COLUMN IF NOT EXISTS end_time TIMESTAMP"))

    # 1. 预约快照：时间来源仍是旧排期列
    conn.execute(text(
        "UPDATE pa_appointment a "
        "SET start_time = s.start_time, end_time = s.end_time, "
        "    book_date = CAST(s.start_time AS DATE) "
        "FROM pa_slot s "
        "WHERE a.slot_id = s.id AND (a.start_time IS NULL OR a.book_date IS NULL)"
    ))

    # 2. 旧排期归并为周排期
    defs = {
        (row.start_clock, row.end_clock): row.id
        for row in conn.execute(
            select(PaSlotDef.id, PaSlotDef.start_clock, PaSlotDef.end_clock)
        )
    }
    legacy_sort = 100
    legacy_slot_rows = conn.execute(text(
        "SELECT id, advisor_id, start_time, end_time, state FROM pa_slot ORDER BY id"
    )).all()
    survivors: dict[tuple[int, int, int], int] = {}
    for row in legacy_slot_rows:
        start_clock = row.start_time.strftime("%H:%M")
        end_clock = row.end_time.strftime("%H:%M")
        def_id = defs.get((start_clock, end_clock))
        if def_id is None:
            code = f"legacy-{start_clock.replace(':', '')}-{end_clock.replace(':', '')}"
            existing = conn.execute(
                select(PaSlotDef.id).where(PaSlotDef.code == code)
            ).first()
            if existing:
                def_id = existing[0]
            else:
                legacy_sort += 1
                def_id = conn.execute(
                    insert(PaSlotDef).values(
                        code=code,
                        start_clock=start_clock,
                        end_clock=end_clock,
                        sort_no=legacy_sort,
                        state="1",
                        create_time=datetime.now(),
                        update_time=datetime.now(),
                    ).returning(PaSlotDef.id)
                ).scalar_one()
            defs[(start_clock, end_clock)] = def_id
        key = (row.advisor_id, row.start_time.isoweekday(), def_id)
        keep_id = survivors.get(key)
        if keep_id is not None:
            conn.execute(text(
                "UPDATE pa_appointment SET slot_id = :keep WHERE slot_id = :dup"
            ), {"keep": keep_id, "dup": row.id})
            conn.execute(text("DELETE FROM pa_slot WHERE id = :sid"), {"sid": row.id})
            continue
        survivors[key] = row.id
        conn.execute(text(
            "UPDATE pa_slot SET weekday = :wd, slot_def_id = :def WHERE id = :sid"
        ), {"wd": key[1], "def": def_id, "sid": row.id})

    # 3. 收敛结构
    conn.execute(text("ALTER TABLE pa_slot DROP COLUMN IF EXISTS start_time"))
    conn.execute(text("ALTER TABLE pa_slot DROP COLUMN IF EXISTS end_time"))
    conn.execute(text("ALTER TABLE pa_slot DROP COLUMN IF EXISTS booked"))
    conn.execute(text("ALTER TABLE pa_slot ALTER COLUMN weekday SET NOT NULL"))
    conn.execute(text("ALTER TABLE pa_slot ALTER COLUMN slot_def_id SET NOT NULL"))
    conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS pa_slot_uniq_weekly "
        "ON pa_slot (advisor_id, weekday, slot_def_id)"
    ))
    null_appts = conn.execute(text(
        "SELECT count(*) FROM pa_appointment WHERE start_time IS NULL OR end_time IS NULL "
        "OR book_date IS NULL"
    )).scalar()
    if null_appts:
        logger.warning(f"{null_appts} 条预约缺少时段快照（排期已不存在），保留可空列待人工处理")
    else:
        conn.execute(text("ALTER TABLE pa_appointment ALTER COLUMN start_time SET NOT NULL"))
        conn.execute(text("ALTER TABLE pa_appointment ALTER COLUMN end_time SET NOT NULL"))
        conn.execute(text("ALTER TABLE pa_appointment ALTER COLUMN book_date SET NOT NULL"))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS pa_appointment_start_time_idx "
        "ON pa_appointment (start_time)"
    ))
    logger.info(f"周排期迁移完成：保留 {len(survivors)} 条周排期")


def migrate_advisor_drop_username(conn: Connection) -> None:
    """把 pa_advisor 收敛为「email 即登录账号」（幂等，可重复执行）。

    历史表结构含 username 列（账号标识），与 email 并存；现已统一用 email
    作为唯一登录账号，本迁移在建表后清理旧结构：
    1. 旧库回填：email 为空 / 'N/A' 的行用 username 补齐（username 原本唯一，
       回填不会产生重复）；
    2. 删除 username 列（不存在则跳过）；
    3. 补建 email 唯一索引（历史库没有；存在大小写重复邮箱时跳过并告警，
       由应用层 lower(email) 查重兜底，不阻塞启动）。
    """
    has_username = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema = current_schema() "
        "  AND table_name = 'pa_advisor' AND column_name = 'username'"
    )).first()
    if not has_username:
        return

    conn.execute(text(
        "UPDATE pa_advisor SET email = username "
        "WHERE (email IS NULL OR email = '' OR email = 'N/A') "
        "  AND username IS NOT NULL AND username NOT IN ('', 'N/A')"
    ))
    dup = conn.execute(text(
        "SELECT lower(email), count(*) FROM pa_advisor "
        "GROUP BY lower(email) HAVING count(*) > 1 LIMIT 5"
    )).all()
    conn.execute(text("ALTER TABLE pa_advisor DROP COLUMN username"))
    if dup:
        logger.warning(
            "pa_advisor 存在大小写重复邮箱，跳过唯一索引创建，请人工合并："
            f"{[d[0] for d in dup]}"
        )
        return
    conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS pa_advisor_email_key ON pa_advisor (lower(email))"
    ))


def seed_initial_admin(conn: Connection) -> None:
    """播种初始管理员账号（幂等，按用户名判重）。

    - 账号：环境变量 ADMIN_USERNAME（默认 admin）；
      口令：ADMIN_PASSWORD（默认 admin123）；
    - 用户名为邮箱格式时同步写入 email 字段，姓名取 @ 前局部部分；
    - 口令以 PBKDF2 哈希落库（见 utils/x_security.py）；
    - 目标用户名已存在（任意角色）则跳过，避免重复播种或覆盖既有账号。
    """
    from x_models.id_x_007.src.utils.x_security import hash_password

    username = (os.environ.get("ADMIN_USERNAME", "")).strip() or "admin"
    existing = conn.execute(
        select(PaUser.id).where(PaUser.username == username).limit(1)
    ).first()
    if existing:
        return
    password = os.environ.get("ADMIN_PASSWORD", "") or "admin123"
    is_email = "@" in username
    conn.execute(
        insert(PaUser).values(
            username=username,
            password=hash_password(password),
            key="N/A",
            role="admin",
            name=username.split("@", 1)[0] if is_email else "管理员",
            email=username if is_email else "N/A",
            state="1",
            is_active=True,
            create_time=datetime.now(),
            update_time=datetime.now(),
        )
    )


def seed_sso_settings(conn: Connection) -> None:
    """播种 CUHK ADFS SSO 配置（幂等：pa_sso_settings 已有数据则跳过）。

    与 ops/init/03_sso.sql 等价；连接外部数据库时 init SQL 不会自动执行，
    由本函数在建表后兜底写入。如需更换凭据，直接改表即可（运行期生效，
    不会被本函数覆盖）。
    """
    existing = conn.execute(select(PaSsoSettings.id).limit(1)).first()
    if existing:
        return
    conn.execute(
        insert(PaSsoSettings).values(
            client_id="2e8949a0-7fd4-4c7a-a380-c9e93c103067",
            client_secret="jEhpM4HPaUX1OdOgNp5HvvRHnuqClYYoIvSozlKb",
            redirect_uri="https://sme-ugo-appointment.cuhk.edu.cn/f/007/user/oauth2",
            create_time=datetime.now(),
            update_time=datetime.now(),
        )
    )


def seed_smtp_settings(conn: Connection) -> None:
    """播种 SMTP 默认配置（幂等：pa_smtp_settings 已有数据则跳过）。

    预置 CUHK 邮件服务器配置（mail.cuhk.edu.cn:587 STARTTLS），
    运行期运维可直接 UPDATE 首行调整，x_mail 实时读表即改即生效。
    """
    existing = conn.execute(select(PaSmtpSettings.id).limit(1)).first()
    if existing:
        return
    conn.execute(
        insert(PaSmtpSettings).values(
            host="mail.cuhk.edu.cn",
            port=587,
            username="smeug@cuhk.edu.cn",
            password="P@cuhksz2026!",
            mail_from="smeug@cuhk.edu.cn",
            create_time=datetime.now(),
            update_time=datetime.now(),
        )
    )


def seed_default_mail_templates(conn: Connection) -> None:
    """播种默认邮件模板（幂等：逐类型查缺补插，已有记录不覆盖管理员的修改）。

    兼容迁移：历史版本的预约成功模板为单一 "booked"（双方同文案），现拆分为
    booked_student / booked_advisor 两类；首次补插这两类时若存在旧 "booked"
    记录，则沿用其正文 HTML（保留管理员自定义），主题取各自新默认。
    """
    from x_models.id_x_007.src.utils.x_mail import DEFAULT_TEMPLATES

    legacy_booked = conn.execute(
        select(PaMailTemplate.html).where(PaMailTemplate.mail_type == "booked").limit(1)
    ).first()
    for mail_type, tpl in DEFAULT_TEMPLATES.items():
        existing = conn.execute(
            select(PaMailTemplate.id).where(PaMailTemplate.mail_type == mail_type).limit(1)
        ).first()
        if existing:
            continue
        html = tpl["html"]
        if mail_type in ("booked_student", "booked_advisor") and legacy_booked:
            html = legacy_booked[0] or html
        conn.execute(
            insert(PaMailTemplate).values(
                mail_type=mail_type,
                subject=tpl["subject"],
                html=html,
                create_time=datetime.now(),
                update_time=datetime.now(),
            )
        )
