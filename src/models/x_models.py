"""数据层：ORM 模型 + Base + 全局会话工厂（引擎启动时注入）。

UGO 朋辈顾问咨询预约系统（id_x_007），表前缀 pa_：
- pa_user        用户账号（admin / advisor / student，student 仅可 SSO 登录）
- pa_advisor     朋辈顾问档案（关联 pa_user，含擅长方向 / 简介 / 照片）
- pa_slot        咨询时段（顾问自管排期，默认名额 1 人）
- pa_appointment 预约记录（预约单号 A+8 位数字）
- pa_feedback    咨询反馈（与预约一一对应，仅顾问 / 管理员可见）
- pa_email_log   邮件发送日志（booked / cancelled / reminder）
- pa_mail_template 邮件模板（库表驱动，管理员可配置文案，缺失时代码内回退默认）
"""
from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import Boolean, Connection, DateTime, ForeignKey, Integer, String, Text, insert, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


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


# ===== 业务模型区（UGO 朋辈顾问咨询预约系统） =====


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
    __table_args__ = {"comment": "朋辈顾问档案表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_user.id"), nullable=False, unique=True, comment="用户ID"
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="姓名")
    grade: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="年级")
    major: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="专业")
    direction: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="擅长方向")
    bio: Mapped[str] = mapped_column(Text, nullable=False, default="N/A", comment="个人简介")
    photo: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="照片（base64 data URL）")
    status: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="状态(1启用/0停用)")
    accepting: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="接待状态(1接待/0暂不接待)")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaSlot(Base):
    __tablename__ = "pa_slot"
    __table_args__ = {"comment": "咨询时段表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    advisor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_advisor.id"), nullable=False, comment="顾问ID"
    )
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="开始时间")
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="结束时间")
    quota: Mapped[int] = mapped_column(Integer, nullable=False, default=1, comment="名额")
    booked: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="已订数")
    state: Mapped[str] = mapped_column(String(255), nullable=False, default="1", comment="状态(1开放/0暂停)")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


class PaAppointment(Base):
    __tablename__ = "pa_appointment"
    __table_args__ = {"comment": "预约记录表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    apply_no: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, comment="预约单号（A+8位数字）")
    slot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_slot.id"), nullable=False, comment="时段ID"
    )
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
    mail_type: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="邮件类型(booked/cancelled/reminder)")
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
    mail_type: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, comment="邮件类型(booked/cancelled/reminder)")
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="", comment="主题模板（支持 {apply_no} 等占位符）")
    html: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="正文 HTML 模板（支持 {apply_no} 等占位符）")
    create_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="创建时间")
    update_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.now, comment="更新时间")


def seed_initial_admin(conn: Connection) -> None:
    """播种初始管理员账号（幂等）。

    - 账号：admin；口令：PA_ADMIN_PASSWORD 环境变量（默认 admin123）；
    - 口令以 PBKDF2 哈希落库（见 utils/x_security.py）；
    - 已存在 admin 角色用户则跳过（兼容 ops/init/02_add_user.sql 先行播种）。
    """
    from x_models.id_x_007.src.utils.x_security import hash_password

    existing = conn.execute(
        select(PaUser.id).where(PaUser.role == "admin").limit(1)
    ).first()
    if existing:
        return
    password = os.environ.get("PA_ADMIN_PASSWORD", "") or "admin123"
    conn.execute(
        insert(PaUser).values(
            username="admin",
            password=hash_password(password),
            key="N/A",
            role="admin",
            name="管理员",
            email="N/A",
            state="1",
            is_active=True,
            create_time=datetime.now(),
            update_time=datetime.now(),
        )
    )


def seed_default_mail_templates(conn: Connection) -> None:
    """播种默认邮件模板（幂等：逐类型查缺补插，已有记录不覆盖管理员的修改）。"""
    from x_models.id_x_007.src.utils.x_mail import DEFAULT_TEMPLATES

    for mail_type, tpl in DEFAULT_TEMPLATES.items():
        existing = conn.execute(
            select(PaMailTemplate.id).where(PaMailTemplate.mail_type == mail_type).limit(1)
        ).first()
        if existing:
            continue
        conn.execute(
            insert(PaMailTemplate).values(
                mail_type=mail_type,
                subject=tpl["subject"],
                html=tpl["html"],
                create_time=datetime.now(),
                update_time=datetime.now(),
            )
        )
