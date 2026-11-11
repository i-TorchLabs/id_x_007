"""邮件工具：SMTP 发送 + pa_email_log 落库。

- SMTP 配置存 pa_smtp_settings 表（取 id 最小行生效），发信时实时读取，
  运行期改表即生效；mail_from 为空时回退 username；
- 未配置 SMTP（host/username/password 任一为空）时不实际发送，
  但仍落库 status="skipped"，便于上线后补查；
- 发送失败不抛异常（status="failed" + error 落库），不影响业务主流程。
"""
from __future__ import annotations

import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from utils.log_util import logger

from sqlalchemy import select

from x_models.id_x_007.src.models.x_models import PaEmailLog, PaSmtpSettings


def _sanitize_header(value: Any) -> str:
    """邮件头注入防护：剔除 CR/LF。"""
    return re.sub(r"[\r\n]+", " ", str(value or "")).strip()


def _smtp_config(session) -> dict[str, str]:
    """从 pa_smtp_settings 表读取 SMTP 配置（取 id 最小行，实时读表即改即生效）。

    读取失败或无数据时返回空配置，send_mail 据此降级为 skipped。
    """
    try:
        row = session.execute(
            select(PaSmtpSettings).order_by(PaSmtpSettings.id).limit(1)
        ).scalars().first()
    except Exception as e:
        logger.error(f"读取 SMTP 配置失败: table=pa_smtp_settings, {e}")
        row = None
    if row is None:
        return {"host": "", "port": "587", "user": "", "password": "", "mail_from": ""}
    user = (row.username or "").strip()
    return {
        "host": (row.host or "").strip(),
        "port": str(row.port or 587),
        "user": user,
        "password": row.password or "",
        "mail_from": (row.mail_from or "").strip() or user,
    }


def send_mail(session, mail_to: str, mail_type: str, subject: str, content: str,
              appointment_id: int | None = None) -> str:
    """发送邮件并写 pa_email_log（由调用方 commit），返回落库状态。

    - mail_type：booked / cancelled / reminder；
    - 收件人为空或 SMTP 未配置：status="skipped"；
    - SMTP 异常：status="failed"，error 记录异常摘要。
    """
    mail_to = _sanitize_header(mail_to)
    subject = _sanitize_header(subject)
    cfg = _smtp_config(session)

    status, error = "sent", ""
    if not mail_to or "@" not in mail_to:
        status, error = "skipped", "收件人为空或非法"
    elif not (cfg["host"] and cfg["user"] and cfg["password"]):
        status, error = "skipped", "SMTP 未配置（pa_smtp_settings 表 host/username/password 为空）"
    else:
        server = None
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = _sanitize_header(cfg["mail_from"])
            message["To"] = mail_to
            message.attach(MIMEText(content, "html"))
            server = smtplib.SMTP(cfg["host"], int(cfg["port"] or 587))
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["mail_from"], [mail_to], message.as_string())
        except Exception as e:
            status, error = "failed", str(e)[:500]
            logger.error(f"邮件发送失败 to={mail_to} type={mail_type}: {e}")
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass

    session.add(PaEmailLog(
        mail_to=mail_to,
        mail_type=mail_type,
        subject=subject,
        content=content,
        status=status,
        error=error,
        appointment_id=appointment_id,
    ))
    if status != "sent":
        logger.warning(f"邮件记录 status={status} to={mail_to} type={mail_type} subject={subject}")
    else:
        logger.info(f"邮件已发送 to={mail_to} type={mail_type} subject={subject}")
    return status


# ===== 库表驱动的邮件模板（003 范式移植）=====
# 占位符：{intro} 开场语、{apply_no} 预约单号、{advisor_name} 顾问、{student_name} 学生、
# {student_no} 学号、{start_time}/{end_time} 起止时间、{topic} 主题、{mode} 方式、{extra} 附加段
_DEFAULT_BODY = (
    "<p>{intro}</p>"
    "<p>预约单号：{apply_no}<br>"
    "顾问：{advisor_name}<br>"
    "学生：{student_name}（{student_no}）<br>"
    "时间：{start_time} ~ {end_time}<br>"
    "主题：{topic}<br>"
    "方式：{mode}</p>"
    "{extra}"
)

# 内置默认模板：pa_mail_template 缺失/渲染异常时的回退，亦用于建表后的幂等播种
DEFAULT_TEMPLATES: dict[str, dict[str, str]] = {
    "booked": {"subject": "【朋辈咨询】预约成功通知", "html": _DEFAULT_BODY},
    "cancelled": {"subject": "【朋辈咨询】预约取消通知", "html": _DEFAULT_BODY},
    "reminder": {"subject": "【朋辈咨询】明日咨询提醒", "html": _DEFAULT_BODY},
}


class _SafeDict(dict):
    """format_map 安全字典：模板引用未提供的占位符时渲染为空串而非抛 KeyError。"""

    def __missing__(self, key: str) -> str:
        return ""


def render_mail(session, mail_type: str, context: dict[str, Any]) -> tuple[str, str]:
    """按 pa_mail_template 渲染 (subject, content)；模板缺失或渲染异常回退内置默认。

    管理员可在库表中调整模板文案，无需改代码发版（D-6 邮件通知可配置）。
    """
    from sqlalchemy import select

    from x_models.id_x_007.src.models.x_models import PaMailTemplate

    fallback = DEFAULT_TEMPLATES.get(mail_type) or DEFAULT_TEMPLATES["booked"]
    subject_tpl, html_tpl = fallback["subject"], fallback["html"]
    try:
        tpl = session.execute(
            select(PaMailTemplate).where(PaMailTemplate.mail_type == mail_type)
        ).scalars().first()
        if tpl and tpl.subject.strip() and tpl.html.strip():
            subject_tpl, html_tpl = tpl.subject, tpl.html
    except Exception as e:
        logger.warning(f"邮件模板读取失败，回退默认模板 type={mail_type}: {e}")

    safe = _SafeDict({k: ("" if v is None else str(v)) for k, v in context.items()})
    try:
        return subject_tpl.format_map(safe), html_tpl.format_map(safe)
    except Exception as e:
        # 模板被改坏（如出现未转义花括号）时回退内置默认，保证通知不中断
        logger.warning(f"邮件模板渲染失败，回退默认模板 type={mail_type}: {e}")
        return fallback["subject"].format_map(safe), fallback["html"].format_map(safe)
