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
              appointment_id: int | None = None, cc: str = "") -> str:
    """发送邮件并写 pa_email_log（由调用方 commit），返回落库状态。

    - mail_type：booked_student / booked_advisor / reminder / cancelled / cancelled_advisor；
    - cc：抄送地址（可选，非法或为空时忽略；落库 mail_to 仅记主收件人）；
    - 收件人为空或 SMTP 未配置：status="skipped"；
    - SMTP 异常：status="failed"，error 记录异常摘要。
    """
    mail_to = _sanitize_header(mail_to)
    cc = _sanitize_header(cc)
    if "@" not in cc or cc == mail_to:
        cc = ""
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
            if cc:
                message["Cc"] = cc
            message.attach(MIMEText(content, "html"))
            server = smtplib.SMTP(cfg["host"], int(cfg["port"] or 587))
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            recipients = [mail_to] + ([cc] if cc else [])
            server.sendmail(cfg["mail_from"], recipients, message.as_string())
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
        logger.info(f"邮件已发送 to={mail_to}{f' cc={cc}' if cc else ''} type={mail_type} subject={subject}")
    return status


# ===== 库表驱动的邮件模板（003 范式移植）=====
# 占位符：{intro} 开场语、{apply_no} 预约单号、{advisor_name} 顾问、{student_email} 学生邮箱、
# {student_no} 学号、{start_time}/{end_time} 起止时间、{topic} 主题、{mode} 方式、{extra} 附加段
_DEFAULT_BODY = (
    "<p>{intro}</p>"
    "<p>预约单号：{apply_no}<br>"
    "顾问：{advisor_name}<br>"
    "学生：{student_email}（{student_no}）<br>"
    "时间：{start_time} ~ {end_time}<br>"
    "主题：{topic}<br>"
    "方式：{mode}</p>"
    "{extra}"
)

# 内置默认模板：pa_mail_template 缺失/渲染异常时的回退，亦用于建表后的幂等播种。
# 五类模板与触发时点：
# - booked_student 预约成功确认（发送给学生）：学生预约成功后；
# - booked_advisor 新预约通知（发送给顾问）：学生预约成功后；
# - reminder 预约前一天提醒（发送给双方）：预约开始前一天 21:00 调度触发；
# - cancelled 取消预约·学生（发送给学生）：学生页面取消预约时；
# - cancelled_advisor 取消预约·顾问（发送给学生，抄送顾问本人）：顾问取消单条预约或取消时段时。
DEFAULT_TEMPLATES: dict[str, dict[str, str]] = {
    "booked_student": {"subject": "【朋辈咨询】预约成功确认", "html": _DEFAULT_BODY},
    "booked_advisor": {"subject": "【朋辈咨询】新预约通知", "html": _DEFAULT_BODY},
    "reminder": {"subject": "【朋辈咨询】明日咨询提醒", "html": _DEFAULT_BODY},
    "cancelled": {"subject": "【朋辈咨询】预约取消通知", "html": _DEFAULT_BODY},
    "cancelled_advisor": {"subject": "【朋辈咨询】预约取消通知（顾问取消）", "html": _DEFAULT_BODY},
}


# 只替换上下文中存在的占位符名，其余花括号（如内联样式 / <style> 块）原样保留。
# 不用 str.format_map：CSS 里的 { color: #fff } 会被当格式说明符解析而抛异常，
# 导致整封邮件静默回退内置默认模板（表现为「后台改了模板但不生效」）。
_PLACEHOLDER_RE = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _render_tpl(tpl: str, context: dict[str, Any]) -> str:
    """替换 {name} 形式的已知占位符；未知占位符与非占位符花括号保持不变。"""
    values = {k: ("" if v is None else str(v)) for k, v in context.items()}
    return _PLACEHOLDER_RE.sub(
        lambda m: values[m.group(1)] if m.group(1) in values else m.group(0), tpl
    )


def render_mail(session, mail_type: str, context: dict[str, Any]) -> tuple[str, str]:
    """按 pa_mail_template 渲染 (subject, content)；模板缺失或渲染异常回退内置默认。

    管理员可在库表中调整模板文案，无需改代码发版（D-6 邮件通知可配置）。
    """
    from sqlalchemy import select

    from x_models.id_x_007.src.models.x_models import PaMailTemplate

    fallback = DEFAULT_TEMPLATES.get(mail_type) or DEFAULT_TEMPLATES["booked_student"]
    subject_tpl, html_tpl = fallback["subject"], fallback["html"]
    try:
        tpl = session.execute(
            select(PaMailTemplate).where(PaMailTemplate.mail_type == mail_type)
        ).scalars().first()
        if tpl and tpl.subject.strip() and tpl.html.strip():
            subject_tpl, html_tpl = tpl.subject, tpl.html
    except Exception as e:
        logger.warning(f"邮件模板读取失败，回退默认模板 type={mail_type}: {e}")

    try:
        return _render_tpl(subject_tpl, context), _render_tpl(html_tpl, context)
    except Exception as e:
        # 兜底：模板异常时回退内置默认，保证通知不中断
        logger.warning(f"邮件模板渲染失败，回退默认模板 type={mail_type}: {e}")
        return _render_tpl(fallback["subject"], context), _render_tpl(fallback["html"], context)
