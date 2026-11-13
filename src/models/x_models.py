"""数据层：ORM 模型 + Base + 全局会话工厂（引擎启动时注入）。

UGO 咨询预约系统（id_x_007），表前缀 pa_：
- pa_user        用户账号（admin / advisor / student，student/advisor 仅可 SSO 登录）
- pa_advisor     档案（独立建档不落 pa_user，SSO 登录按账号标识匹配档案确定顾问身份，
                 含账号标识 / 邮箱 / 擅长方向 / 简介 / 照片）
- pa_advisor_allow 顾问 SSO 登录白名单（email + allow，仅校验顾问：不在名单或 allow=False 的顾问邮箱拒绝 SSO 登录，学生不受限）
- pa_slot        咨询时段（管理端代管发布，每时段 1 人）
- pa_appointment 预约记录（预约单号 A+8 位数字）
- pa_feedback    咨询反馈（与预约一一对应，仅管理员和顾问本人可见）
- pa_email_log   邮件发送日志（booked / cancelled / reminder）
- pa_mail_template 邮件模板（库表驱动，管理员可配置文案，缺失时代码内回退默认）
- pa_sso_settings SSO 单点登录配置（取代 .env 的 PA_OAUTH_* 配置，取 id 最小行生效）
- pa_smtp_settings SMTP 邮件配置（取代 .env 的 PA_SMTP_* 配置，取 id 最小行生效）
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
    username: Mapped[str] = mapped_column(
        String(255), nullable=False, default="N/A", unique=True, comment="账号标识（CUHK 邮箱/upn，SSO 登录据此匹配顾问身份）"
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="姓名")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="N/A", comment="邮箱")
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


class PaSlot(Base):
    __tablename__ = "pa_slot"
    __table_args__ = {"comment": "咨询时段表"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ID")
    advisor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pa_advisor.id"), nullable=False, comment="顾问ID"
    )
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="开始时间")
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="结束时间")
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
            password="P@cuhksz2024!",
            mail_from="smeug@cuhk.edu.cn",
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
