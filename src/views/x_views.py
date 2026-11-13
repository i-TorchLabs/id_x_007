"""业务层：全部业务逻辑，view_* 命名；异常在视图内捕获并转换为业务响应。

UGO 咨询预约系统（pa 业务域），复刻插件化 GraphQL 架构：
- 保持 code/msg/data 统一响应结构；
- 宿主 DB 契约为同步 SQLAlchemy（sessionmaker[Session]），全部视图为同步 def；
- Token 从 GraphQL 请求头 Header "Token" 读取；
- 文件下载以 base64 返回（FileResponse）；
- 登录链路：admin 用户名密码（RSA 传输加密 + 防爆破 + 验证码），
  student/advisor 走 CUHK SSO（ADFS OAuth2 授权码流，advisor 按 pa_advisor.username 匹配档案）。
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import os
import re
import secrets
import string
import time
from datetime import datetime, timedelta
from io import BytesIO
from typing import Any

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Border, PatternFill, Side
from sqlalchemy import delete, desc, func, or_, select
from strawberry.types import Info

from utils.log_util import get_request_id, logger

from x_models.id_x_007.src.utils.x_audit import audit

from x_models.id_x_007.src.models.x_models import (
    PaAdvisor,
    PaAdvisorAllow,
    PaAppointment,
    PaEmailLog,
    PaFeedback,
    PaMailTemplate,
    PaSlot,
    PaSsoSettings,
    PaUser,
    get_session,
)
from x_models.id_x_007.src.schemas.x_schemas import (
    AcceptingSetInput,
    AdvisorCancelInput,
    AdvisorCompleteInput,
    AdvisorIdInput,
    AdvisorListInput,
    AdvisorPageInput,
    ApiResponse,
    AppointmentCreateInput,
    AppointmentIdInput,
    FeedbackSetInput,
    FileResponse,
    HealthType,
    LoginInput,
    LoginKeyType,
    LogoutInput,
    ManageAdvisorCreateInput,
    ManageAdvisorIdInput,
    ManageAdvisorListInput,
    ManageAdvisorUpdateInput,
    ManageAllowCreateInput,
    ManageAllowIdInput,
    ManageAllowListInput,
    ManageAllowUpdateInput,
    ManageAppointmentListInput,
    ManageEmailLogListInput,
    ManageExportInput,
    ManageFeedbackListInput,
    ManageMailTemplateUpdateInput,
    OauthInput,
    PageInput,
    RegisterInput,
    SlotBatchUploadInput,
    SlotCreateInput,
    SlotIdInput,
    SlotStateInput,
    SlotUpdateInput,
)
from x_models.id_x_007.src.utils import x_crypto, x_oauth
from x_models.id_x_007.src.utils.x_mail import DEFAULT_TEMPLATES, render_mail, send_mail
from x_models.id_x_007.src.utils.x_security import (
    DUMMY_HASH,
    check_password,
    hash_password,
)

# ===== 进程级时区锚定（Asia/Shanghai, UTC+8） =====
# 防容器未设 TZ 或本地裸跑导致 datetime.now() 回退 UTC；
# setdefault 不覆盖已由 Dockerfile/compose 注入的 TZ，tzset() 使 C 库 localtime 即时生效。
os.environ.setdefault("TZ", "Asia/Shanghai")
if hasattr(time, "tzset"):  # POSIX-only；容器/开发机均为 Linux/macOS
    time.tzset()


def _env_int(name: str, default: int) -> int:
    """安全解析整型环境变量，非法值回退默认（避免导入期崩溃）。"""
    try:
        return int(os.environ.get(name, "") or default)
    except (TypeError, ValueError):
        return default


# 分页参数边界：防 pageSize 过大拖垮内存、page 非法导致 500
MAX_PAGE_LIMIT = 100
# 上传文件大小上限（base64 解码后估算），固定 32MB
MAX_UPLOAD_BYTES = 32 * 1024 * 1024
# 时间规则：预约须在开始前 24 小时之前；取消（学生/顾问）在开始前 4 小时内禁止
BOOK_DEADLINE_HOURS = 24
CANCEL_DEADLINE_HOURS = 4
# 咨询方式白名单
VALID_MODES = ("online", "offline")
# 预约状态白名单
VALID_APPOINTMENT_STATES = ("booked", "cancelled_student", "cancelled_advisor", "completed")
# 状态中文标签（导出用）
STATE_LABELS = {
    "booked": "已预约",
    "cancelled_student": "学生已取消",
    "cancelled_advisor": "顾问已取消",
    "completed": "已完成",
}

# ===== OAuth2 配置（来自 pa_sso_settings 表，参考 id_x_010 实现） =====
# client_secret 仅服务端持有，存库后由本层读入缓存，绝不进入前端代码。
def load_oauth_config() -> dict | None:
    """从 pa_sso_settings 表读取首行 SSO 配置并注入全局缓存。

    取 id 最小行作为生效配置（与 id_x_010 的 sso_settings 语义一致）。
    表无数据或读取失败时返回 None，缓存保持原状，view_oauth_login 拒绝 SSO 登录。
    """
    from x_models.id_x_007.src.models.x_models import get_session, set_oauth_config

    try:
        with get_session()() as session:
            row = session.execute(
                select(PaSsoSettings).order_by(PaSsoSettings.id).limit(1)
            ).scalars().first()
    except Exception as e:
        logger.error(f"{_rid()}读取 SSO 配置失败: table=pa_sso_settings, {e}", exc_info=True)
        return None

    if row is None:
        logger.warning(f"{_rid()}pa_sso_settings 表无数据，SSO 登录不可用")
        return None

    config = {
        "client_id": row.client_id,
        "client_secret": row.client_secret,
        "redirect_uri": row.redirect_uri,
    }
    set_oauth_config(config)
    logger.info(f"{_rid()}SSO 配置已加载: 来源=pa_sso_settings 表, client_id={row.client_id}")
    return config


def _oauth_config() -> dict | None:
    """读取 SSO 配置：优先进程缓存，未命中时回库加载（支持运行期改库即生效）。"""
    from x_models.id_x_007.src.models.x_models import get_oauth_config

    return get_oauth_config() or load_oauth_config()


def _oauth_config_missing() -> bool:
    """SSO 服务端配置是否缺失。"""
    cfg = _oauth_config()
    return not (cfg and cfg.get("client_id") and cfg.get("client_secret") and cfg.get("redirect_uri"))


# ===== 通用工具 =====
def _rid() -> str:
    return get_request_id()


def _resp(code: int, msg: str, data: Any = None) -> ApiResponse:
    return ApiResponse(code=code, msg=msg, data=data if data is not None else {})


def _get_token(info: Info) -> str | None:
    """从 GraphQL 请求上下文中读取 Token 请求头。"""
    ctx = info.context
    request = ctx.get("request") if isinstance(ctx, dict) else getattr(ctx, "request", None)
    if request is None:
        return None
    return request.headers.get("Token")


def _get_user_by_token(info: Info) -> PaUser | None:
    """按 Token 解析用户；无效/过期/已停用返回 None。"""
    token = _get_token(info)
    if not token or token == "N/A":
        return None
    try:
        maker = get_session()
        with maker() as session:
            return session.execute(
                select(PaUser).where(PaUser.key == token, PaUser.state == "1")
            ).scalars().first()
    except Exception as e:
        logger.error(f"{_rid()}Token验证失败: {e}")
        return None


def _verify_token(info: Info) -> PaUser | None:
    """登录态鉴权：任意已登录用户，返回用户对象（失败返回 None）。"""
    return _get_user_by_token(info)


def _verify_admin(info: Info) -> PaUser | None:
    """管理端鉴权：仅 admin 角色。"""
    user = _get_user_by_token(info)
    return user if (user and user.role == "admin") else None


def _verify_admin_or_advisor(info: Info) -> PaUser | None:
    """顾问域鉴权：admin（代管）或 advisor（本人自助）。"""
    user = _get_user_by_token(info)
    return user if (user and user.role in ("admin", "advisor")) else None


def _first(session, stmt):
    return session.execute(stmt).scalars().first()


def _count(session, stmt) -> int:
    result = session.execute(select(func.count()).select_from(stmt.subquery()))
    return int(result.scalar() or 0)


def _clamp_page(page: Any, page_size: Any) -> tuple[int, int]:
    """收敛分页参数：page >= 1，1 <= pageSize <= MAX_PAGE_LIMIT，非法值回退默认。"""
    try:
        page = int(page)
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(page_size)
    except (TypeError, ValueError):
        page_size = 10
    return max(page, 1), min(max(page_size, 1), MAX_PAGE_LIMIT)


def _ms_to_dt(value: Any) -> datetime | None:
    """毫秒时间戳安全解析：非法/越界返回 None，不抛 500。"""
    try:
        return datetime.fromtimestamp(int(value) / 1000)
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def _parse_dt(value: Any) -> datetime | None:
    """时段时间入参解析：毫秒时间戳字符串或 ISO（YYYY-MM-DD HH:MM[:SS]），失败返回 None。"""
    text = str(value or "").strip()
    if not text:
        return None
    if text.isdigit():
        return _ms_to_dt(text)
    try:
        return datetime.fromisoformat(text.replace("T", " ")[:19])
    except ValueError:
        return None


def _to_int(value: Any) -> int | None:
    """ID/数字类入参安全转换：非法返回 None（调用方返回 400/404），不抛 500。"""
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _fmt_dt(value: datetime | None, fmt: str = "%Y-%m-%d %H:%M") -> str:
    return value.strftime(fmt) if value else ""


def _dt_ms(value: datetime | None) -> str:
    """编辑回填用毫秒时间戳字符串。"""
    return str(int(value.timestamp() * 1000)) if value else ""


def _month_range(month: str) -> tuple[datetime, datetime] | None:
    """解析 YYYY-MM 为 [月初, 次月初) 区间；非法返回 None。"""
    m = re.match(r"^(\d{4})-(\d{1,2})$", str(month or "").strip())
    if not m:
        return None
    year, mon = int(m.group(1)), int(m.group(2))
    if not 1 <= mon <= 12:
        return None
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)
    return start, end


def _day_range(date_s: str) -> tuple[datetime, datetime] | None:
    """解析 YYYY-MM-DD 为 [当日 00:00, 次日 00:00) 区间；非法返回 None。"""
    try:
        start = datetime.strptime(str(date_s or "").strip(), "%Y-%m-%d")
    except ValueError:
        return None
    return start, start + timedelta(days=1)


def _gen_apply_no(session) -> str:
    """生成预约单号：A + 8 位数字，查重防撞。"""
    for _ in range(20):
        apply_no = "A" + "".join(secrets.choice(string.digits) for _ in range(8))
        exists = _first(session, select(PaAppointment.id).where(PaAppointment.apply_no == apply_no))
        if not exists:
            return apply_no
    # 极端撞号兜底：时间戳尾号
    return "A" + str(int(datetime.now().timestamp() * 1000))[-8:]


def _student_no_of(user: PaUser) -> str:
    """提取学号：优先姓名括号内数字（SSO 姓名形如 "ZHANG San (123456789)"），
    其次用户名/邮箱的纯数字本地部分，均无则 N/A。"""
    m = re.search(r"[(（](\d{4,})[)）]", user.name or "")
    if m:
        return m.group(1)
    local = (user.username or "").split("@")[0].strip()
    if local.isdigit():
        return local
    return "N/A"


def _own_advisor_profile(session, user: PaUser) -> PaAdvisor | None:
    """按登录账号匹配本人启用中的顾问档案（pa_advisor.username == pa_user.username）。"""
    return _first(session, select(PaAdvisor).where(
        PaAdvisor.username == user.username, PaAdvisor.status == "1"
    ))


def _manage_scope_advisor_id(session, user: PaUser) -> tuple[int, str]:
    """管理端数据域：admin 返回 0（不限制），advisor 返回本人档案 id（只看本人数据）。

    advisor 无启用中的本人档案时返回 (-1, 错误消息)。
    """
    if user.role == "admin":
        return 0, ""
    advisor = _own_advisor_profile(session, user)
    if not advisor:
        return -1, "顾问档案不存在或已停用"
    return advisor.id, ""


def _resolve_advisor_scope(session, user: PaUser, advisor_id: Any) -> tuple[PaAdvisor | None, str]:
    """定位操作目标顾问（admin 代管 / advisor 本人自助）。

    - admin：代管模式，须显式指定 advisorId；
    - advisor：强制绑定本人档案（advisorId 留空或等于本人 id），指定他人 advisorId 视为越权。
    返回 (顾问对象, 错误消息)；成功时错误消息为空串。
    """
    aid = _to_int(advisor_id)
    if user.role == "advisor":
        advisor = _own_advisor_profile(session, user)
        if not advisor:
            return None, "顾问档案不存在或已停用"
        if aid and aid != advisor.id:
            return None, "无权操作其他顾问的数据"
        return advisor, ""
    if not aid:
        return None, "请指定顾问（advisorId）"
    advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == aid))
    return (advisor, "") if advisor else (None, "顾问不存在")


def _cancelable(state: str, start_time: datetime | None, now: datetime) -> bool:
    """是否可取消：booked 且距开始 > 4 小时。"""
    return bool(
        state == "booked" and start_time
        and now < start_time - timedelta(hours=CANCEL_DEADLINE_HOURS)
    )


def _completable(state: str, start_time: datetime | None, now: datetime) -> bool:
    """是否可标记完成：booked 且开始时间已过。"""
    return bool(state == "booked" and start_time and now >= start_time)


def _mode_label(mode: str) -> str:
    return "线上" if mode == "online" else "线下"


def mail_context(appt: PaAppointment, slot: PaSlot, advisor_name: str,
                 intro: str = "", extra: str = "") -> dict:
    """构造邮件模板渲染上下文（与 pa_mail_template 占位符一一对应）。"""
    return {
        "intro": intro,
        "apply_no": appt.apply_no,
        "advisor_name": advisor_name,
        "student_name": appt.student_name,
        "student_no": appt.student_no,
        "start_time": _fmt_dt(slot.start_time),
        "end_time": _fmt_dt(slot.end_time),
        "topic": appt.topic,
        "mode": _mode_label(appt.mode),
        "extra": f"<p>{extra}</p>" if extra else "",
    }


def _notify_both(session, *, mail_type: str, appt: PaAppointment, slot: PaSlot,
                 advisor_name: str, intro: str, extra: str = "",
                 student_user: PaUser | None = None,
                 advisor_email: str = "") -> None:
    """给学生与顾问各发一封通知邮件（均落 pa_email_log，失败不影响主流程）。

    主题与正文经 pa_mail_template 渲染（管理员可配置），模板缺失回退内置默认。
    """
    subject, content = render_mail(
        session, mail_type, mail_context(appt, slot, advisor_name, intro, extra)
    )
    if student_user:
        send_mail(session, student_user.email, mail_type, subject, content, appt.id)
    if advisor_email and advisor_email != "N/A":
        send_mail(session, advisor_email, mail_type, subject, content, appt.id)


def _style_header_row(ws, col_count: int) -> None:
    """Excel 首行样式：细边框 + 浅紫底色（复用既有导出风格）。"""
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )
    fill = PatternFill(start_color="C0C0FF", end_color="C0C0FF", fill_type="solid")
    for cell in next(ws.iter_rows(min_row=1, max_row=1, max_col=col_count)):
        cell.border = thin_border
        cell.fill = fill


def _workbook_to_file(wb: Workbook, file_name: str) -> FileResponse:
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return FileResponse(
        code=200,
        msg="success",
        file_name=file_name,
        file_base64=base64.b64encode(buffer.getvalue()).decode("ascii"),
    )


# ===== 登录防暴力破解 =====
# 同一用户名连续失败达到阈值后锁定一段时间；内存实现，进程重启自动清零
LOGIN_MAX_FAILURES = _env_int("PA_LOGIN_MAX_FAILURES", 5)
LOGIN_LOCK_SECONDS = _env_int("PA_LOGIN_LOCK_SECONDS", 600)
# {username: [fail_count, first_fail_ts, lock_until_ts]}
_login_failures: dict[str, list[float]] = {}


def _login_locked(username: str) -> int:
    """返回剩余锁定秒数，未锁定返回 0。"""
    rec = _login_failures.get(username)
    if not rec:
        return 0
    lock_until = rec[2]
    remaining = int(lock_until - datetime.now().timestamp())
    if remaining <= 0:
        _login_failures.pop(username, None)
        return 0
    return remaining


def _record_login_failure(username: str) -> None:
    now = datetime.now().timestamp()
    rec = _login_failures.get(username)
    if not rec or now - rec[1] > LOGIN_LOCK_SECONDS:
        rec = [0, now, 0.0]
    rec[0] += 1
    if rec[0] >= LOGIN_MAX_FAILURES:
        rec[2] = now + LOGIN_LOCK_SECONDS
        logger.warning(f"{_rid()}账号 {username} 连续失败 {int(rec[0])} 次，锁定 {LOGIN_LOCK_SECONDS}s")
    _login_failures[username] = rec
    # 防内存无限增长：超过一万条时清理已过期记录
    if len(_login_failures) > 10_000:
        for k in [k for k, v in _login_failures.items() if v[2] and v[2] < now]:
            _login_failures.pop(k, None)


def _clear_login_failures(username: str) -> None:
    _login_failures.pop(username, None)


# ===== 图形验证码（连续失败后要求验证码） =====
CAPTCHA_AFTER_FAILURES = _env_int("PA_CAPTCHA_AFTER_FAILURES", 3)
_CAPTCHA_TTL_SECONDS = 300
_CAPTCHA_MAX_ENTRIES = 10_000
_CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去除易混淆 0/O/1/I
_CAPTCHA_LEN = 4
# {captcha_id: (code_lower, expire_ts)}
_captcha_store: dict[str, tuple[str, float]] = {}


def _captcha_required(username: str) -> bool:
    """该账号是否已触发验证码门槛（基于已有失败计数）。"""
    rec = _login_failures.get(username)
    return bool(rec and rec[0] >= CAPTCHA_AFTER_FAILURES)


def _render_captcha_svg(code: str) -> str:
    """生成带干扰的 SVG 验证码（干扰线/噪点/字符旋转错位），无第三方绘图依赖。"""
    import random
    width, height = 132, 48
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#f4f6fb"/>',
    ]
    for _ in range(4):  # 干扰曲线
        x1, y1 = random.randint(0, width), random.randint(0, height)
        x2, y2 = random.randint(0, width), random.randint(0, height)
        cx, cy = random.randint(0, width), random.randint(0, height)
        color = f"#{random.randint(0, 0xFFFFFF):06x}"
        parts.append(
            f'<path d="M{x1},{y1} Q{cx},{cy} {x2},{y2}" stroke="{color}" '
            f'stroke-width="1" fill="none" opacity="0.5"/>'
        )
    for _ in range(30):  # 噪点
        px, py = random.randint(0, width), random.randint(0, height)
        color = f"#{random.randint(0, 0xFFFFFF):06x}"
        parts.append(f'<circle cx="{px}" cy="{py}" r="1" fill="{color}" opacity="0.6"/>')
    step = width // (_CAPTCHA_LEN + 1)
    for idx, ch in enumerate(code):  # 字符旋转 + 错位
        x = step * (idx + 1)
        y = height // 2 + random.randint(-6, 6)
        rot = random.randint(-28, 28)
        color = f"#{random.randint(0, 0x555555):06x}"
        size = random.randint(22, 28)
        parts.append(
            f'<text x="{x}" y="{y + size // 3}" transform="rotate({rot} {x} {y})" '
            f'font-family="monospace" font-size="{size}" font-weight="bold" fill="{color}">'
            f"{ch}</text>"
        )
    parts.append("</svg>")
    return "".join(parts)


def _generate_captcha() -> dict[str, str]:
    """生成验证码，返回 {captcha_id, image_base64(data URL)}。"""
    now = datetime.now().timestamp()
    if len(_captcha_store) > _CAPTCHA_MAX_ENTRIES:
        for k in [k for k, (_, exp) in _captcha_store.items() if exp < now]:
            _captcha_store.pop(k, None)
    code = "".join(secrets.choice(_CAPTCHA_CHARS) for _ in range(_CAPTCHA_LEN))
    captcha_id = secrets.token_urlsafe(16)
    _captcha_store[captcha_id] = (code.lower(), now + _CAPTCHA_TTL_SECONDS)
    svg = _render_captcha_svg(code)
    b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return {"captcha_id": captcha_id, "image_base64": f"data:image/svg+xml;base64,{b64}"}


def _verify_captcha(captcha_id: str, captcha_code: str) -> bool:
    """一次性校验：无论对错都作废，防重放/枚举。"""
    if not captcha_id or not captcha_code:
        return False
    rec = _captcha_store.pop(captcha_id, None)
    if not rec:
        return False
    code, exp = rec
    if exp < datetime.now().timestamp():
        return False
    return secrets.compare_digest(code, captcha_code.strip().lower())


def _login_fail_response(username: str, info: Info | None = None) -> ApiResponse:
    """登录失败统一响应：失败计数达验证码门槛时随 401 一并下发新验证码。"""
    audit("auth.login_fail", None, username=username, info=info, result="fail", detail="账号或密码错误")
    if _captcha_required(username):
        cap = _generate_captcha()
        return _resp(401, "Login Fail", {
            "need_captcha": "true",
            "captcha_id": cap["captcha_id"],
            "image_base64": cap["image_base64"],
        })
    return _resp(401, "Login Fail")


# ===== 健康检查 =====
def view_health(info: Info) -> HealthType:
    logger.info(f"{_rid()}health check")
    return HealthType(status="ok", service="id_x_007")


# ---------------------------
# 认证相关
# ---------------------------
def view_login_key(info: Info) -> LoginKeyType:
    """下发登录传输加密公钥（RSA-2048，PEM）。

    前端以此公钥（RSA-OAEP-SHA256）加密用户名/密码，密文只在后端内存私钥可解。
    """
    return LoginKeyType(public_key=x_crypto.public_key_pem())


def _decrypt_login_credentials(data: LoginInput) -> tuple[str, str] | None:
    """按 encrypted 标志解析登录凭据；加密模式下解密失败返回 None。"""
    if not data.encrypted:
        return data.username.strip(), data.password.strip()
    username = x_crypto.decrypt_field(data.username)
    password = x_crypto.decrypt_field(data.password)
    if username is None or password is None:
        return None
    return username.strip(), password.strip()


def view_login(info: Info, data: LoginInput) -> ApiResponse:
    """账号密码登录（仅 admin；student/advisor 一律走 CUHK SSO）。"""
    maker = get_session()
    with maker() as session:
        try:
            credentials = _decrypt_login_credentials(data)
            if credentials is None:
                # 密文无法解密（非本公钥加密/被篡改/密钥已轮换）：统一按登录失败处理，不泄露细节
                logger.warning(f"{_rid()}登录凭据解密失败")
                audit("auth.login_fail", None, info=info, result="fail", detail="登录凭据解密失败")
                return _resp(400, "登录请求无效，请刷新页面后重试")
            username, password = credentials
            # 防暴力破解：锁定中的账号直接拒绝
            locked_for = _login_locked(username)
            if locked_for:
                audit("auth.login_fail", None, username=username, info=info, result="fail", detail="账号锁定中")
                return _resp(423, f"账号已锁定，请 {locked_for // 60 + 1} 分钟后再试")
            # 验证码门槛：连续失败达阈值后必须先通过验证码
            if _captcha_required(username):
                if not _verify_captcha(data.captcha_id, data.captcha_code):
                    audit("auth.login_fail", None, username=username, info=info, result="fail", detail="验证码错误或缺失")
                    cap = _generate_captcha()
                    return _resp(428, "需要验证码", {
                        "need_captcha": "true",
                        "captcha_id": cap["captcha_id"],
                        "image_base64": cap["image_base64"],
                    })
            obj = _first(session, select(PaUser).where(PaUser.username == username))
            if not obj:
                check_password(DUMMY_HASH, password)  # 抹平时序，防用户名枚举
                _record_login_failure(username)
                return _login_fail_response(username, info)
            if obj.role in ("student", "advisor"):
                # 学生/顾问禁止密码登录（无本地口令），引导走 SSO
                audit("auth.login_fail", obj, info=info, result="fail", detail="学生/顾问账号尝试密码登录")
                return _resp(403, "学生与朋辈顾问账号请使用 CUHK SSO 登录")
            if obj.state != "1":
                audit("auth.login_fail", obj, info=info, result="fail", detail="账号已停用")
                return _resp(403, "账号已停用")
            if not obj.is_active:
                # 自助注册的 admin 默认未激活，须运维登库置 is_active=True
                audit("auth.login_fail", obj, info=info, result="fail", detail="账号待激活")
                return _resp(403, "账号待激活，请联系运维人员激活后登录")
            if obj.password == "N/A":
                # SSO 账号（student/advisor）无本地口令：禁止密码登录，防 "N/A" 明文兼容被利用
                check_password(DUMMY_HASH, password)
                _record_login_failure(username)
                return _login_fail_response(username, info)
            ok, new_hash = check_password(obj.password, password)
            if not ok:
                _record_login_failure(username)
                return _login_fail_response(username, info)
            _clear_login_failures(username)
            key = secrets.token_urlsafe(32)
            obj.key = key
            obj.update_time = datetime.now()
            if new_hash:  # 旧明文密码自动迁移为 PBKDF2 哈希
                obj.password = new_hash
            session.commit()
            logger.info(f"{_rid()}User {username} logged in")
            audit("auth.login", obj, info=info, detail="账号密码登录成功")
            return _resp(200, "Login Success", {
                "user_id": str(obj.id),
                "token": key,
                "role": obj.role,
                "name": obj.name,
                "username": obj.username,
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def view_register(info: Info, data: RegisterInput) -> ApiResponse:
    """管理员自助注册（/admin-login 页入口）。

    安全设计：
    - 以邮箱作为登录用户名（pa_user.username = email），不再单独输入用户名；
    - 注册后 is_active=False，账号不可登录；须运维人员手动登库
      将 pa_user.is_active 置为 True 后方可登录（人工准入兜底）；
    - 落库口令为 PBKDF2 哈希，注册成功不自动登录（引导走正常登录链路）。
    """
    maker = get_session()
    with maker() as session:
        try:
            # 字段校验（邮箱即登录用户名）
            email = data.email.strip()
            password = data.password.strip()
            name = data.name.strip()
            if not _EMAIL_RE.match(email) or len(email) > 64:
                return _resp(400, "邮箱格式不合法（不超过 64 字符）")
            if not 6 <= len(password) <= 64:
                return _resp(400, "密码长度需为 6~64 位")
            if not name or len(name) > 64:
                return _resp(400, "姓名必填且不超过 64 字符")
            if _first(session, select(PaUser).where(PaUser.username == email)):
                return _resp(409, "该邮箱已注册")
            now = datetime.now()
            session.add(PaUser(
                username=email,
                password=hash_password(password),
                key="N/A",
                role="admin",
                name=name,
                email=email,
                state="1",
                is_active=False,
                create_time=now,
                update_time=now,
            ))
            session.commit()
            logger.info(f"{_rid()}管理员注册成功（待激活） email={email}")
            audit("auth.register", None, username=email, info=info, detail="管理员自助注册（待激活）")
            return _resp(200, "注册成功，账号待运维激活后方可登录")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_logout(info: Info, data: LogoutInput) -> ApiResponse:
    user = _verify_token(info)
    if not user or (user.id != data.user_id and user.role != "admin"):
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            obj = _first(session, select(PaUser).where(PaUser.id == data.user_id))
            if obj:
                obj.key = "N/A"
                session.commit()
            audit("auth.logout", user, info=info, target=f"user#{data.user_id}")
            return _resp(200, "Logout Success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_oauth_login(info: Info, data: OauthInput) -> ApiResponse:
    """CUHK SSO 登录（student/advisor）：ADFS 授权码授予流。

    流程：
    1. 前端经 ADFS /authorize 重定向回业务站点，携带 code；
    2. 本接口用 code + client_secret（仅服务端持有）到 /token 换 id_token；
    3. 验签 / 校验 id_token，提取 upn/email/name；
    4. 顾问白名单校验：portal=advisor（/admin-login 的顾问 SSO 按钮）发起的
       登录一律校验；命中顾问档案的账号无论入口也校验（防伪造 portal 绕过）；
       其余（学生走 /user-login）放行。SSO 邮箱（缺失时回退 upn）须在
       pa_advisor_allow 表中且 allow=True，否则拒绝登录并提示联系系统管理员；
    5. 按 username(=upn) 查 pa_user 并定角色：顾问入口（portal=advisor，已过
       白名单）签发 advisor 会话，登录后进入管理后台 /admin/advisor-management
       （后台对 advisor 开放，权限管理模块仅 admin）；学生入口按顾问档案有无定
       advisor/student；账密管理员账号一律拒绝 SSO（防 admin 角色被降级）；
       无档案则自动建档，老用户角色随本次入口/档案同步升降；
    6. 返回服务端签发的独立会话 token，不再暴露 IdP token。
    """
    logger.info(f"{_rid()}OAuth 登录请求: has_code={bool(data.code)} state_len={len(data.state or '')} portal={data.portal or 'N/A'}")
    payload_data: dict | None = None
    if _oauth_config_missing():
        logger.error(f"{_rid()}OAuth2 服务端配置缺失（pa_sso_settings 表无数据）")
        return _resp(500, "SSO 服务未配置")
    elif data.code:
        oauth_cfg = _oauth_config() or {}
        # 防重放 nonce：与本次授权码绑定，ADFS 回显后由 exchange_code_for_token 校验
        nonce = hashlib.sha256(data.code.encode("utf-8")).hexdigest()
        token_resp = x_oauth.exchange_code_for_token(
            code=data.code,
            client_id=oauth_cfg["client_id"],
            client_secret=oauth_cfg["client_secret"],
            redirect_uri=oauth_cfg["redirect_uri"],
            expected_nonce=nonce,
        )
        if token_resp is None:
            logger.warning(f"{_rid()}OAuth /token 换取失败（code 无效/过期/已用/重放或网络问题）")
            return _resp(401, "Invalid OAuth Code")
        id_token = x_oauth.extract_id_token(token_resp)
        if not id_token:
            logger.warning(f"{_rid()}OAuth /token 响应缺少 id_token: keys={list(token_resp.keys())}")
            return _resp(401, "Invalid OAuth Token Response")
        logger.info(f"{_rid()}OAuth 换取 id_token 成功，开始验签")
        payload_data, reason = x_oauth.verify_id_token(
            id_token, expected_aud=oauth_cfg["client_id"]
        )
        if payload_data is None:
            # 失败诊断直接进 warn.log：payload keys 是定位 ADFS 配置问题的关键证据
            _payload = x_oauth.decode_payload_unverified(id_token) or {}
            logger.warning(
                f"{_rid()}OAuth id_token 验签/校验失败: reason={reason} "
                f"keys={sorted(_payload.keys())} aud={_payload.get('aud')!r} "
                f"iss={_payload.get('iss')!r} exp={_payload.get('exp')!r} now={int(time.time())}"
            )
        else:
            # 身份声明解析：对 ADFS 声明规则差异容错，缺失时返回 None
            identity = x_oauth.resolve_identity_claims(payload_data)
            if identity is None:
                logger.warning(f"{_rid()}OAuth 身份声明解析失败: keys={sorted(payload_data.keys())}")
                payload_data = None
            else:
                payload_data["_identity"] = identity
                logger.info(
                    f"{_rid()}OAuth 身份解析成功: upn_claim={identity['upn_claim']} "
                    f"email_claim={identity['email_claim']}"
                )

    if payload_data is None:
        # 无授权码 / 换票失败 / 验签失败统一拒绝（旧隐式流 oauth_token 已废弃，不再接受）
        return _resp(401, "Invalid OAuth Code")

    maker = get_session()
    with maker() as session:
        try:
            identity = payload_data.pop("_identity", None) or {}
            upn = str(identity.get("upn") or payload_data.get("upn") or "").strip()
            email = str(identity.get("email") or payload_data.get("email") or "").strip()
            # upn 缺失时回退到 email 作为账号标识，避免落库空串
            if not upn:
                upn = email or "N/A"
                logger.warning(f"{_rid()}OAuth upn 缺失，回退为 {upn}")
            name = str(identity.get("display_name") or "").strip() or "N/A"

            # 顾问身份识别：upn 命中管理员预建且启用中的顾问档案即为 advisor
            advisor_profile = _first(session, select(PaAdvisor).where(
                PaAdvisor.username == upn, PaAdvisor.status == "1"
            ))

            # 顾问 SSO 登录白名单校验：从顾问入口（/admin-login 的
            # Advisor SSO Login，portal=advisor）发起的登录一律校验；命中
            # 顾问档案的账号无论入口也校验（防伪造 portal 绕过）；其余
            # （学生走 /user-login）放行。邮箱（缺失时回退 upn）须在
            # pa_advisor_allow 中且 allow=True；不区分大小写。
            if data.portal == "advisor" or advisor_profile:
                check_email = (email or upn).strip().lower()
                allow_entry = _first(session, select(PaAdvisorAllow).where(
                    func.lower(PaAdvisorAllow.email) == check_email
                ))
                if not allow_entry or not allow_entry.allow:
                    logger.warning(f"{_rid()}顾问 SSO 登录被白名单拒绝: {check_email}")
                    audit("auth.sso_login", None, username=upn, info=info, result="fail",
                          detail=f"{check_email} 不在顾问 SSO 登录白名单")
                    return _resp(
                        403,
                        f"登录失败，{check_email} 不是有效的顾问，"
                        "请联系系统管理员 smeit@cuhk.edu.cn",
                    )

            obj = _first(session, select(PaUser).where(PaUser.username == upn))
            if obj and obj.state != "1":
                return _resp(403, "账号已停用")
            # 账密管理员（password 非 N/A 为本地口令建档）不受理 SSO 登录，
            # 防止其 admin 角色被降级；SSO 建档账号（password="N/A"）不受限
            if obj and obj.role == "admin" and obj.password != "N/A":
                logger.warning(f"{_rid()}admin 账号 {upn} 尝试 SSO 登录，已拒绝")
                audit("auth.sso_login", obj, info=info, result="fail",
                      detail="admin 账号不可走 SSO，请使用账号密码登录")
                return _resp(403, "管理员账号请使用账号密码登录")

            # 本次登录角色：顾问入口（Consultant SSO Login，已过白名单）签发
            # advisor 会话，登录后进入管理后台（后台对 advisor 开放，权限管理
            # 模块除外）；学生入口按顾问档案定 advisor/student
            if data.portal == "advisor":
                login_role = "advisor"
            else:
                login_role = "advisor" if advisor_profile else "student"

            session_key = secrets.token_urlsafe(32)
            if not obj:
                # 首次 SSO 登录：自动建档（无本地口令，password="N/A"）
                obj = PaUser(
                    username=upn,
                    password="N/A",
                    key=session_key,
                    role=login_role,
                    name=name,
                    email=email or "N/A",
                    state="1",
                )
                session.add(obj)
                session.commit()
                session.refresh(obj)
                logger.warning(f"{_rid()}SSO 新用户建档 {upn} {name} {email}（{obj.role}）")
            else:
                # 老用户：统一签发新会话密钥；建档缺失的姓名/邮箱用 SSO 声明补全
                obj.key = session_key
                if obj.name in ("", "N/A") and name != "N/A":
                    obj.name = name
                if obj.email in ("", "N/A") and email:
                    obj.email = email
                # 角色随本次登录入口/顾问档案升降（白名单移除或档案
                # 停用后下次登录生效；账密管理员已在上方拦下不受影响）
                obj.role = login_role
                obj.update_time = datetime.now()
                session.commit()
            # 顾问档案邮箱缺失时用 SSO 声明补全（取消/提醒等邮件通知依赖该邮箱）
            if advisor_profile and advisor_profile.email in ("", "N/A") and email:
                advisor_profile.email = email
                advisor_profile.update_time = datetime.now()
                session.commit()
            role = obj.role
            logger.info(f"{_rid()}SSO 登录成功 {upn}（{role}）")
            audit("auth.sso_login", obj, info=info, detail="CUHK SSO 登录成功")
            return _resp(200, "Login Success", {
                "user_id": str(obj.id),
                "token": session_key,
                "role": role,
                "name": obj.name,
                "username": obj.username,
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


# ---------------------------
# 学生端 · 顾问浏览与预约
# ---------------------------
def _bookable_slots_of(session, advisor: PaAdvisor, now: datetime, limit: int | None = None) -> list[dict]:
    """顾问当前可约时段：开放中、未被预约、距开始 > 24 小时；顾问「暂不接待」时为空。"""
    if advisor.accepting != "1" or advisor.status != "1":
        return []
    deadline = now + timedelta(hours=BOOK_DEADLINE_HOURS)
    query = (
        select(PaSlot)
        .where(
            PaSlot.advisor_id == advisor.id,
            PaSlot.state == "1",
            PaSlot.booked < 1,
            PaSlot.start_time > deadline,
        )
        .order_by(PaSlot.start_time)
    )
    if limit:
        query = query.limit(limit)
    slots = session.execute(query).scalars().all()
    return [{
        "slotId": s.id,
        "startTime": _fmt_dt(s.start_time),
        "endTime": _fmt_dt(s.end_time),
        "booked": s.booked,
    } for s in slots]


def view_advisor_list(info: Info, data: AdvisorListInput) -> ApiResponse:
    """顾问卡片列表（登录即可）：status="1" 的顾问 + 每人未来可约时段（≤5 条）。"""
    if not _verify_token(info):
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            page, page_size = _clamp_page(data.page, data.page_size)
            now = datetime.now()
            query = select(PaAdvisor).where(PaAdvisor.status == "1")
            if data.major.strip():
                query = query.where(PaAdvisor.major == data.major.strip())
            if data.direction.strip():
                query = query.where(PaAdvisor.direction == data.direction.strip())
            total = _count(session, query)
            objs = session.execute(
                query.order_by(PaAdvisor.id)
                .offset((page - 1) * page_size).limit(page_size)
            ).scalars().all()
            detail = [{
                "advisorId": obj.id,
                "name": obj.name,
                "grade": obj.grade,
                "major": obj.major,
                "direction": obj.direction,
                "bio": obj.bio,
                "photo": obj.photo,
                "accepting": obj.accepting,
                "slots": _bookable_slots_of(session, obj, now, limit=5),
            } for obj in objs]
            # 筛选项：全部启用顾问的专业/方向去重（排除空与 N/A）
            majors = sorted({
                row[0] for row in session.execute(
                    select(PaAdvisor.major).where(PaAdvisor.status == "1").distinct()
                ).all() if row[0] and row[0] != "N/A"
            })
            directions = sorted({
                row[0] for row in session.execute(
                    select(PaAdvisor.direction).where(PaAdvisor.status == "1").distinct()
                ).all() if row[0] and row[0] != "N/A"
            })
            return _resp(200, "success", {
                "total": total,
                "list": detail,
                "majors": majors,
                "directions": directions,
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_advisor_slot_list(info: Info, data: AdvisorIdInput) -> ApiResponse:
    """指定顾问的全部可约时段（登录即可，过滤规则同 advisorList）。"""
    if not _verify_token(info):
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == data.advisor_id))
            if not advisor or advisor.status != "1":
                return _resp(404, "顾问不存在")
            return _resp(200, "success", {
                "advisorId": advisor.id,
                "name": advisor.name,
                "list": _bookable_slots_of(session, advisor, datetime.now()),
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_my_appointment_list(info: Info, data: PageInput) -> ApiResponse:
    """我的预约列表（本人，分页，附可取消标记）。"""
    user = _verify_token(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            page, page_size = _clamp_page(data.page, data.page_size)
            now = datetime.now()
            query = (
                select(PaAppointment, PaSlot)
                .join(PaSlot, PaAppointment.slot_id == PaSlot.id)
                .where(PaAppointment.student_user_id == user.id)
            )
            total = _count(session, query)
            rows = session.execute(
                query.order_by(desc(PaAppointment.create_time), desc(PaAppointment.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).all()
            detail = []
            for appt, slot in rows:
                advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == appt.advisor_id))
                detail.append({
                    "appointmentId": appt.id,
                    "applyNo": appt.apply_no,
                    "advisorName": advisor.name if advisor else "N/A",
                    "startTime": _fmt_dt(slot.start_time),
                    "endTime": _fmt_dt(slot.end_time),
                    "topic": appt.topic,
                    "mode": appt.mode,
                    "state": appt.state,
                    "cancelable": _cancelable(appt.state, slot.start_time, now),
                    "createTime": _fmt_dt(appt.create_time, "%Y-%m-%d %H:%M:%S"),
                })
            return _resp(200, "success", {"total": total, "list": detail})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_student_appointment_create(info: Info, data: AppointmentCreateInput) -> ApiResponse:
    """学生预约（仅 student）：表单校验 + 24h 截止 + 行锁占用/重复校验 + 双方邮件通知。"""
    user = _verify_token(info)
    if not user:
        return _resp(401, "Token Error")
    if user.role != "student":
        # 预约下单仅学生本人操作（admin/advisor 不代客预约）
        return _resp(403, "仅学生可发起预约")
    # 表单校验（与前端联动规则一致）
    topic = (data.topic or "").strip()
    content = (data.content or "").strip()
    mode = (data.mode or "").strip()
    phone = (data.phone or "").strip()
    wechat = (data.wechat or "").strip()
    meeting_link = (data.meeting_link or "").strip()
    if not topic:
        return _resp(400, "咨询主题不能为空")
    if not content:
        return _resp(400, "咨询内容不能为空")
    if mode not in VALID_MODES:
        return _resp(400, "咨询方式不合法（online/offline）")
    if not phone:
        return _resp(400, "电话不能为空")
    if mode == "online" and not wechat:
        return _resp(400, "线上咨询需填写微信号")
    if mode == "offline":
        meeting_link = ""  # 线下咨询不保留会议链接
    maker = get_session()
    with maker() as session:
        try:
            # 并发安全：对 slot 行加锁后再校验占用与重复预约
            slot = session.execute(
                select(PaSlot).where(PaSlot.id == data.slot_id).with_for_update()
            ).scalars().first()
            if not slot:
                return _resp(404, "时段不存在")
            if slot.state != "1":
                return _resp(403, "该时段已暂停预约")
            advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == slot.advisor_id))
            if not advisor or advisor.status != "1":
                return _resp(403, "顾问不可预约")
            if advisor.accepting != "1":
                return _resp(403, "该顾问暂不接待预约")
            now = datetime.now()
            if now >= slot.start_time - timedelta(hours=BOOK_DEADLINE_HOURS):
                return _resp(403, f"需在咨询开始前 {BOOK_DEADLINE_HOURS} 小时之前预约")
            if slot.booked >= 1:
                return _resp(403, "该时段已被预约")
            dup = _first(session, select(PaAppointment.id).where(
                PaAppointment.slot_id == slot.id,
                PaAppointment.student_user_id == user.id,
                PaAppointment.state == "booked",
            ))
            if dup:
                return _resp(403, "您已预约该时段，请勿重复预约")
            apply_no = _gen_apply_no(session)
            appt = PaAppointment(
                apply_no=apply_no,
                slot_id=slot.id,
                advisor_id=advisor.id,
                student_user_id=user.id,
                student_name=user.name,
                student_no=_student_no_of(user),
                topic=topic,
                content=content,
                mode=mode,
                phone=phone,
                wechat=wechat,
                meeting_link=meeting_link,
                state="booked",
            )
            slot.booked += 1
            slot.update_time = now
            session.add(appt)
            session.commit()
            logger.info(f"{_rid()}学生 {user.username} 预约顾问 {advisor.name}，单号 {apply_no}")
            audit("appointment.create", user, info=info, target=apply_no,
                  detail=f"顾问={advisor.name} 时段#{slot.id} 方式={mode}")
            # 预约成功邮件（双方；失败仅落日志不影响预约结果）
            student_user = _first(session, select(PaUser).where(PaUser.id == user.id))
            _notify_both(
                session,
                mail_type="booked",
                appt=appt,
                slot=slot,
                advisor_name=advisor.name,
                intro="您的朋辈咨询预约已成功：",
                student_user=student_user,
                advisor_email=advisor.email,
            )
            session.commit()
            return _resp(200, "预约成功", {"appointmentId": appt.id, "applyNo": apply_no})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_student_appointment_cancel(info: Info, data: AppointmentIdInput) -> ApiResponse:
    """学生取消自己的预约（须填取消原因；开始前 4 小时内禁止），双方邮件通知。"""
    user = _verify_token(info)
    if not user:
        return _resp(401, "Token Error")
    reason = (data.reason or "").strip()
    if not reason:
        return _resp(400, "取消原因不能为空")
    maker = get_session()
    with maker() as session:
        try:
            appt = _first(session, select(PaAppointment).where(
                PaAppointment.id == data.appointment_id
            ))
            if not appt:
                return _resp(404, "预约不存在")
            if appt.student_user_id != user.id:
                return _resp(403, "无权操作该预约")
            if appt.state != "booked":
                return _resp(403, "当前状态不可取消")
            # 对 slot 行加锁，保证 booked 计数在并发下准确
            slot = session.execute(
                select(PaSlot).where(PaSlot.id == appt.slot_id).with_for_update()
            ).scalars().first()
            if not slot:
                return _resp(404, "时段不存在")
            now = datetime.now()
            if now >= slot.start_time - timedelta(hours=CANCEL_DEADLINE_HOURS):
                return _resp(403, f"咨询开始前 {CANCEL_DEADLINE_HOURS} 小时内不可取消")
            appt.state = "cancelled_student"
            appt.cancel_reason = reason
            appt.update_time = now
            slot.booked = max(slot.booked - 1, 0)
            slot.update_time = now
            session.commit()
            logger.info(f"{_rid()}学生取消预约 {appt.apply_no}：{reason}")
            audit("appointment.cancel", user, info=info, target=appt.apply_no,
                  detail=f"学生取消，原因={reason}")
            advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == appt.advisor_id))
            _notify_both(
                session,
                mail_type="cancelled",
                appt=appt,
                slot=slot,
                advisor_name=advisor.name if advisor else "N/A",
                intro="以下朋辈咨询预约已由学生取消：",
                extra=f"取消原因：{reason}",
                student_user=_first(session, select(PaUser).where(PaUser.id == user.id)),
                advisor_email=advisor.email if advisor else "",
            )
            session.commit()
            return _resp(200, "取消成功")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


# ---------------------------
# 排期管理（advisor 本人自助 / 管理端代管）
# ---------------------------
def view_advisor_my_slot_list(info: Info, data: AdvisorPageInput) -> ApiResponse:
    """排期列表（advisor 本人或 admin 代管；admin 须指定 advisorId）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            page, page_size = _clamp_page(data.page, data.page_size)
            query = select(PaSlot).where(PaSlot.advisor_id == advisor.id)
            total = _count(session, query)
            objs = session.execute(
                query.order_by(desc(PaSlot.start_time), desc(PaSlot.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).scalars().all()
            detail = [{
                "slotId": obj.id,
                "startTime": _fmt_dt(obj.start_time),
                "endTime": _fmt_dt(obj.end_time),
                # 编辑回填用毫秒时间戳
                "startTimeMs": _dt_ms(obj.start_time),
                "endTimeMs": _dt_ms(obj.end_time),
                "booked": obj.booked,
                "state": obj.state,
            } for obj in objs]
            return _resp(200, "success", {
                "total": total,
                "list": detail,
                "advisorId": advisor.id,
                "accepting": advisor.accepting,
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_advisor_slot_create(info: Info, data: SlotCreateInput) -> ApiResponse:
    """新增咨询时段（advisor 本人或 admin 代管；admin 须指定 advisorId）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            start_dt = _parse_dt(data.start_time)
            end_dt = _parse_dt(data.end_time)
            if not start_dt or not end_dt:
                return _resp(400, "时间格式不合法")
            if start_dt >= end_dt:
                return _resp(400, "开始时间需早于结束时间")
            if start_dt <= datetime.now():
                return _resp(400, "只能创建未来的时段")
            obj = PaSlot(
                advisor_id=advisor.id,
                start_time=start_dt,
                end_time=end_dt,
                booked=0,
                state="1",
            )
            session.add(obj)
            session.commit()
            logger.info(f"{_rid()}顾问 {advisor.name} 新增时段 {_fmt_dt(start_dt)}~{_fmt_dt(end_dt)}")
            audit("slot.create", user, info=info, target=f"slot#{obj.id}",
                  detail=f"{_fmt_dt(start_dt)}~{_fmt_dt(end_dt)} 顾问={advisor.name}")
            return _resp(200, "success", {"slotId": obj.id})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def _owned_slot(session, advisor: PaAdvisor, slot_id: Any) -> PaSlot | None:
    """取属于该顾问的时段（防越权操作他人排期）。"""
    sid = _to_int(slot_id)
    if not sid:
        return None
    return _first(session, select(PaSlot).where(
        PaSlot.id == sid, PaSlot.advisor_id == advisor.id
    ))


def view_advisor_slot_update(info: Info, data: SlotUpdateInput) -> ApiResponse:
    """修改咨询时段（起止时间）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            obj = _owned_slot(session, advisor, data.slot_id)
            if not obj:
                return _resp(404, "时段不存在")
            start_dt = _parse_dt(data.start_time)
            end_dt = _parse_dt(data.end_time)
            if not start_dt or not end_dt:
                return _resp(400, "时间格式不合法")
            if start_dt >= end_dt:
                return _resp(400, "开始时间需早于结束时间")
            obj.start_time = start_dt
            obj.end_time = end_dt
            obj.update_time = datetime.now()
            session.commit()
            audit("slot.update", user, info=info, target=f"slot#{obj.id}",
                  detail=f"{_fmt_dt(start_dt)}~{_fmt_dt(end_dt)}")
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_advisor_slot_delete(info: Info, data: SlotIdInput) -> ApiResponse:
    """删除咨询时段：存在有效（booked）预约时拒绝；有历史预约记录时建议改用暂停。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            obj = _owned_slot(session, advisor, data.slot_id)
            if not obj:
                return _resp(404, "时段不存在")
            active = _count(session, select(PaAppointment).where(
                PaAppointment.slot_id == obj.id,
                PaAppointment.state == "booked",
            ))
            if active > 0:
                return _resp(403, "该时段存在有效预约，不可删除")
            history = _count(session, select(PaAppointment).where(
                PaAppointment.slot_id == obj.id
            ))
            if history > 0:
                # 已取消/已完成的预约仍引用该时段（外键），删除会破坏历史记录
                return _resp(403, "该时段存在历史预约记录，不可删除，请使用暂停")
            session.execute(delete(PaSlot).where(PaSlot.id == obj.id))
            session.commit()
            logger.info(f"{_rid()}顾问 {advisor.name} 删除时段 {_fmt_dt(obj.start_time)}")
            audit("slot.delete", user, info=info, target=f"slot#{obj.id}",
                  detail=f"{_fmt_dt(obj.start_time)}~{_fmt_dt(obj.end_time)} 顾问={advisor.name}")
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_advisor_slot_state(info: Info, data: SlotStateInput) -> ApiResponse:
    """暂停/恢复咨询时段。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    if data.state not in ("1", "0"):
        return _resp(400, "状态不合法（1开放/0暂停）")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            obj = _owned_slot(session, advisor, data.slot_id)
            if not obj:
                return _resp(404, "时段不存在")
            obj.state = data.state
            obj.update_time = datetime.now()
            session.commit()
            audit("slot.state", user, info=info, target=f"slot#{obj.id}",
                  detail="开放" if data.state == "1" else "暂停")
            return _resp(200, "success", {"state": obj.state})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


# 批量上传模板列名（与 advisorSlotTemplate 下载一致）
_SLOT_UPLOAD_COLUMNS = ("日期", "开始时间", "结束时间")


def _parse_upload_day(value: Any) -> str | None:
    """解析上传单元格中的日期为 YYYY-MM-DD（兼容 Excel 日期型与文本型）。"""
    if value is None or (not isinstance(value, str) and pd.isna(value)):
        return None
    if hasattr(value, "strftime") and not isinstance(value, str):
        try:
            return value.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            return None
    m = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", str(value).strip())
    if not m:
        return None
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def _parse_upload_clock(value: Any) -> str | None:
    """解析上传单元格中的时刻为 HH:MM（兼容 Excel 时间型与文本型）。"""
    if value is None or (not isinstance(value, str) and pd.isna(value)):
        return None
    if hasattr(value, "strftime") and not isinstance(value, str):
        try:
            return value.strftime("%H:%M")
        except (ValueError, TypeError):
            return None
    m = re.match(r"^(\d{1,2}):(\d{2})", str(value).strip())
    if not m:
        return None
    hour, minute = int(m.group(1)), int(m.group(2))
    if hour > 23 or minute > 59:
        return None
    return f"{hour:02d}:{minute:02d}"


def view_advisor_slot_batch_upload(info: Info, data: SlotBatchUploadInput) -> ApiResponse:
    """批量上传排期（.xlsx，列：日期/开始时间/结束时间）。

    逐行校验：解析失败/规则不符仅计为失败行并记录原因，不中断整批上传；
    同顾问同起止时间的时段已存在时视为成功（更新时间戳），否则新增。
    """
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            if not data.file_base64:
                return _resp(400, "文件不存在")
            # 大小限制：base64 解码前即可估算（约 3/4），防止超大载荷 OOM
            if len(data.file_base64) * 3 // 4 > MAX_UPLOAD_BYTES:
                return _resp(400, "文件过大")
            if not data.file_name.lower().endswith(".xlsx"):
                return _resp(400, "文件格式不正确")
            try:
                file_bytes = base64.b64decode(data.file_base64, validate=True)
            except (binascii.Error, ValueError):
                return _resp(400, "文件内容不是合法的 base64")
            try:
                df = pd.read_excel(BytesIO(file_bytes), engine="openpyxl", sheet_name=0)
            except Exception:
                return _resp(400, "无法解析的 Excel 文件")
            missing = [c for c in _SLOT_UPLOAD_COLUMNS if c not in df.columns]
            if missing:
                return _resp(400, f"模板列缺失：{'、'.join(missing)}（请下载最新模板）")

            now = datetime.now()
            success_num, fail_num = 0, 0
            errors: list[dict] = []
            for index, row in df.iterrows():
                row_no = int(index) + 2  # 表头占第 1 行
                values = [row.get(c) for c in _SLOT_UPLOAD_COLUMNS]
                # 整行为空：跳过不计入
                if all(v is None or (not isinstance(v, str) and pd.isna(v)) or str(v).strip() == ""
                       for v in values):
                    continue
                try:
                    day = _parse_upload_day(row.get("日期"))
                    start_clock = _parse_upload_clock(row.get("开始时间"))
                    end_clock = _parse_upload_clock(row.get("结束时间"))
                    if not day or not start_clock or not end_clock:
                        raise ValueError("日期/时间格式不合法（日期 YYYY-MM-DD，时间 HH:MM）")
                    start_dt = datetime.strptime(f"{day} {start_clock}", "%Y-%m-%d %H:%M")
                    end_dt = datetime.strptime(f"{day} {end_clock}", "%Y-%m-%d %H:%M")
                    if start_dt >= end_dt:
                        raise ValueError("开始时间需早于结束时间")
                    if start_dt <= now:
                        raise ValueError("只能创建未来的时段")
                    existing = _first(session, select(PaSlot).where(
                        PaSlot.advisor_id == advisor.id,
                        PaSlot.start_time == start_dt,
                        PaSlot.end_time == end_dt,
                    ))
                    if existing:
                        existing.update_time = now
                    else:
                        session.add(PaSlot(
                            advisor_id=advisor.id,
                            start_time=start_dt,
                            end_time=end_dt,
                            booked=0,
                            state="1",
                        ))
                    session.commit()
                    success_num += 1
                except Exception as e:
                    # 单行失败仅记录报告，不中断整批
                    session.rollback()
                    fail_num += 1
                    errors.append({"row": row_no, "reason": str(e)[:200]})
            logger.info(f"{_rid()}顾问 {advisor.name} 批量上传排期：成功 {success_num} 失败 {fail_num}")
            audit("slot.batch_upload", user, info=info, detail=f"成功 {success_num} 行 / 失败 {fail_num} 行")
            return _resp(200, "success", {
                "success": success_num,
                "fail": fail_num,
                "errors": errors,
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_advisor_slot_template(info: Info) -> FileResponse:
    """下载批量排期模板（xlsx：日期/开始时间/结束时间 + 示例行）。"""
    if not _verify_admin_or_advisor(info):
        return FileResponse(code=401, msg="Token Error")
    try:
        wb = Workbook()
        ws = wb.active
        ws.append(list(_SLOT_UPLOAD_COLUMNS))
        # 示例行：明天 10:00-11:00
        sample_day = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        ws.append([sample_day, "10:00", "11:00"])
        _style_header_row(ws, len(_SLOT_UPLOAD_COLUMNS))
        return _workbook_to_file(wb, "SlotTemplate.xlsx")
    except Exception as e:
        logger.error(f"{_rid()}{e}")
        return FileResponse(code=500, msg="服务器错误")


def view_advisor_accepting_set(info: Info, data: AcceptingSetInput) -> ApiResponse:
    """设置顾问「暂不接待」整体开关（accepting=0 时学生端不展示可约时段；advisor 本人或 admin 代管）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    if data.accepting not in ("1", "0"):
        return _resp(400, "接待状态不合法（1接待/0暂不接待）")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            advisor.accepting = data.accepting
            advisor.update_time = datetime.now()
            session.commit()
            audit("slot.accepting", user, info=info, target=f"advisor#{advisor.id}",
                  detail="恢复接待" if advisor.accepting == "1" else "暂停接待")
            return _resp(200, "success", {"accepting": advisor.accepting})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


# ---------------------------
# 预约处理与反馈（advisor 本人自助 / 管理端代管）
# ---------------------------
def _advisor_appointment_item(session, appt: PaAppointment, slot: PaSlot,
                              now: datetime, advisor_name: str = "") -> dict:
    """预约明细项（含反馈字段，仅 admin 与顾问本人可见）。"""
    feedback = _first(session, select(PaFeedback).where(
        PaFeedback.appointment_id == appt.id
    ))
    student = _first(session, select(PaUser).where(PaUser.id == appt.student_user_id))
    item = {
        "appointmentId": appt.id,
        "advisorId": appt.advisor_id,
        "applyNo": appt.apply_no,
        "studentName": appt.student_name,
        "studentNo": appt.student_no,
        "studentEmail": student.email if student else "",
        "startTime": _fmt_dt(slot.start_time),
        "endTime": _fmt_dt(slot.end_time),
        "topic": appt.topic,
        "content": appt.content,
        "mode": appt.mode,
        "phone": appt.phone,
        "wechat": appt.wechat,
        "meetingLink": appt.meeting_link,
        "state": appt.state,
        "cancelReason": appt.cancel_reason,
        "cancelable": _cancelable(appt.state, slot.start_time, now),
        "completable": _completable(appt.state, slot.start_time, now),
        "hasFeedback": bool(feedback),
        "feedbackSummary": feedback.summary if feedback else "",
        "feedbackHandle": feedback.handle if feedback else "",
        "feedbackNeedFollowup": feedback.need_followup if feedback else "",
        "createTime": _fmt_dt(appt.create_time, "%Y-%m-%d %H:%M:%S"),
    }
    if advisor_name:
        item["advisorName"] = advisor_name
    return item


def view_advisor_appointment_cancel(info: Info, data: AdvisorCancelInput) -> ApiResponse:
    """顾问取消预约（advisor 本人或 admin 代管；须填取消原因；开始前 4 小时内禁止），双方邮件通知。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    reason = (data.reason or "").strip()
    if not reason:
        return _resp(400, "取消原因不能为空")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            appt = _first(session, select(PaAppointment).where(
                PaAppointment.id == data.appointment_id,
                PaAppointment.advisor_id == advisor.id,
            ))
            if not appt:
                return _resp(404, "预约不存在")
            if appt.state != "booked":
                return _resp(403, "当前状态不可取消")
            slot = session.execute(
                select(PaSlot).where(PaSlot.id == appt.slot_id).with_for_update()
            ).scalars().first()
            if not slot:
                return _resp(404, "时段不存在")
            now = datetime.now()
            if now >= slot.start_time - timedelta(hours=CANCEL_DEADLINE_HOURS):
                return _resp(403, f"咨询开始前 {CANCEL_DEADLINE_HOURS} 小时内不可取消")
            appt.state = "cancelled_advisor"
            appt.cancel_reason = reason
            appt.update_time = now
            slot.booked = max(slot.booked - 1, 0)
            slot.update_time = now
            session.commit()
            logger.info(f"{_rid()}顾问 {advisor.name} 取消预约 {appt.apply_no}：{reason}")
            audit("appointment.cancel_by_advisor", user, info=info, target=appt.apply_no,
                  detail=f"原因={reason}")
            _notify_both(
                session,
                mail_type="cancelled",
                appt=appt,
                slot=slot,
                advisor_name=advisor.name,
                intro="以下朋辈咨询预约已由顾问取消：",
                extra=f"取消原因：{reason}",
                student_user=_first(session, select(PaUser).where(
                    PaUser.id == appt.student_user_id
                )),
                advisor_email=advisor.email,
            )
            session.commit()
            return _resp(200, "取消成功")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_advisor_appointment_complete(info: Info, data: AdvisorCompleteInput) -> ApiResponse:
    """标记咨询完成（开始时间已过方可标记）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            appt = _first(session, select(PaAppointment).where(
                PaAppointment.id == data.appointment_id,
                PaAppointment.advisor_id == advisor.id,
            ))
            if not appt:
                return _resp(404, "预约不存在")
            if appt.state != "booked":
                return _resp(403, "当前状态不可标记完成")
            slot = _first(session, select(PaSlot).where(PaSlot.id == appt.slot_id))
            if not slot or datetime.now() < slot.start_time:
                return _resp(403, "咨询开始时间未到，不可标记完成")
            appt.state = "completed"
            appt.update_time = datetime.now()
            session.commit()
            logger.info(f"{_rid()}预约 {appt.apply_no} 标记完成")
            audit("appointment.complete", user, info=info, target=appt.apply_no)
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_feedback_set(info: Info, data: FeedbackSetInput) -> ApiResponse:
    """填写/更新咨询反馈（仅 completed 预约，upsert；advisor 本人或 admin 代管）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    need_followup = "1" if str(data.need_followup).strip() == "1" else "0"
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            appt = _first(session, select(PaAppointment).where(
                PaAppointment.id == data.appointment_id,
                PaAppointment.advisor_id == advisor.id,
            ))
            if not appt:
                return _resp(404, "预约不存在")
            if appt.state != "completed":
                return _resp(403, "仅已完成的咨询可填写反馈")
            feedback = _first(session, select(PaFeedback).where(
                PaFeedback.appointment_id == appt.id
            ))
            if not feedback:
                feedback = PaFeedback(
                    appointment_id=appt.id,
                    advisor_id=advisor.id,
                )
                session.add(feedback)
            feedback.summary = (data.summary or "").strip()
            feedback.handle = (data.handle or "").strip()
            feedback.need_followup = need_followup
            feedback.update_time = datetime.now()
            session.commit()
            audit("appointment.feedback", user, info=info, target=appt.apply_no,
                  detail=f"需跟进={'是' if need_followup == '1' else '否'}")
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def _append_appointment_rows(session, ws, rows) -> None:
    """预约导出公共行写入（rows 为 (appointment, slot) 列表，恒含顾问列）。"""
    row_num = 0
    for appt, slot in rows:
        row_num += 1
        advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == appt.advisor_id))
        values = [row_num, appt.apply_no, advisor.name if advisor else "N/A"]
        student = _first(session, select(PaUser).where(PaUser.id == appt.student_user_id))
        values.extend([
            appt.student_name,
            appt.student_no,
            student.email if student else "",
            _fmt_dt(slot.start_time),
            _fmt_dt(slot.end_time),
            appt.topic,
            appt.content,
            _mode_label(appt.mode),
            appt.phone,
            appt.wechat,
            appt.meeting_link,
            STATE_LABELS.get(appt.state, appt.state),
            appt.cancel_reason,
            _fmt_dt(appt.create_time, "%Y-%m-%d %H:%M:%S"),
        ])
        ws.append(values)


# ---------------------------
# 顾问端 · 我的预约（advisor 本人自助 / 管理端代管）
# ---------------------------
def view_advisor_appointment_list(info: Info, data: ManageAppointmentListInput) -> ApiResponse:
    """顾问预约明细（advisor 仅本人；admin 代管须指定 advisorId；可按日期/状态筛选）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return _resp(400, err)
            page, page_size = _clamp_page(data.page, data.page_size)
            now = datetime.now()
            query = select(PaAppointment, PaSlot).join(
                PaSlot, PaAppointment.slot_id == PaSlot.id
            ).where(PaAppointment.advisor_id == advisor.id)
            if data.date.strip():
                day = _day_range(data.date)
                if not day:
                    return _resp(400, "日期格式不合法（YYYY-MM-DD）")
                query = query.where(PaSlot.start_time >= day[0], PaSlot.start_time < day[1])
            if data.state in VALID_APPOINTMENT_STATES:
                query = query.where(PaAppointment.state == data.state)
            total = _count(session, query)
            rows = session.execute(
                query.order_by(desc(PaSlot.start_time), desc(PaAppointment.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).all()
            detail = [
                _advisor_appointment_item(session, appt, slot, now)
                for appt, slot in rows
            ]
            return _resp(200, "success", {
                "total": total,
                "list": detail,
                "advisorId": advisor.id,
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_advisor_appointment_export(info: Info, data: ManageExportInput) -> FileResponse:
    """顾问个人历史预约导出（advisor 仅本人；admin 代管须指定 advisorId；可按月份过滤，Excel base64）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return FileResponse(code=401, msg="Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor, err = _resolve_advisor_scope(session, user, data.advisor_id)
            if not advisor:
                return FileResponse(code=400, msg=err)
            rows, err = _filtered_appointment_rows(session, advisor.id, data.month)
            if rows is None:
                return FileResponse(code=400, msg=err)
            wb = Workbook()
            ws = wb.active
            header = ["序号", "预约单号", "顾问", "学生姓名", "学号", "邮箱",
                      "开始时间", "结束时间",
                      "咨询主题", "咨询内容", "方式", "电话", "微信", "会议链接",
                      "状态", "取消原因", "创建时间"]
            ws.append(header)
            _append_appointment_rows(session, ws, rows)
            _style_header_row(ws, len(header))
            audit("export.my_appointments", user, info=info,
                  detail=f"advisor_id={advisor.id} month={data.month} 共 {len(rows)} 行")
            return _workbook_to_file(wb, "MyAppointmentExport.xlsx")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return FileResponse(code=500, msg="服务器错误")


# ---------------------------
# 管理后台 · 顾问管理（仅 admin）
# ---------------------------
def view_manage_advisor_list(info: Info, data: ManageAdvisorListInput) -> ApiResponse:
    """顾问列表（分页，keyword 匹配姓名/用户名/专业/方向；advisor 仅见本人档案）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            page, page_size = _clamp_page(data.page, data.page_size)
            query = select(PaAdvisor)
            # 数据域：advisor 只能看到本人档案（admin 不限制）
            if user.role == "advisor":
                query = query.where(PaAdvisor.username == user.username)
            keyword = data.keyword.strip()
            if keyword:
                query = query.where(or_(
                    PaAdvisor.name.contains(keyword),
                    PaAdvisor.username.contains(keyword),
                    PaAdvisor.major.contains(keyword),
                    PaAdvisor.direction.contains(keyword),
                ))
            total = _count(session, query)
            rows = session.execute(
                query.order_by(desc(PaAdvisor.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).scalars().all()
            detail = []
            for advisor in rows:
                slot_count = _count(session, select(PaSlot).where(
                    PaSlot.advisor_id == advisor.id
                ))
                appointment_count = _count(session, select(PaAppointment).where(
                    PaAppointment.advisor_id == advisor.id
                ))
                detail.append({
                    "advisorId": advisor.id,
                    "username": advisor.username,
                    "name": advisor.name,
                    "email": advisor.email,
                    "grade": advisor.grade,
                    "major": advisor.major,
                    "direction": advisor.direction,
                    "bio": advisor.bio,
                    "photo": advisor.photo,
                    "status": advisor.status,
                    "accepting": advisor.accepting,
                    "slotCount": slot_count,
                    "appointmentCount": appointment_count,
                })
            return _resp(200, "success", {"total": total, "list": detail})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_advisor_create(info: Info, data: ManageAdvisorCreateInput) -> ApiResponse:
    """创建顾问（仅 admin）：仅建 pa_advisor 档案（不落 pa_user；顾问经 CUHK SSO 登录后按账号匹配档案）。"""
    user = _verify_admin(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            username = data.username.strip()
            name = data.name.strip()
            if not username or not name:
                return _resp(400, "用户名与姓名不能为空")
            existing = _first(session, select(PaAdvisor.id).where(PaAdvisor.username == username))
            if existing:
                return _resp(403, "该登录账号已存在顾问档案")
            advisor = PaAdvisor(
                username=username,
                name=name,
                email=data.email.strip() or "N/A",
                grade=data.grade.strip() or "N/A",
                major=data.major.strip() or "N/A",
                direction=data.direction.strip() or "N/A",
                bio=data.bio.strip() or "N/A",
                photo=data.photo or "",
                status="1",
                accepting="1",
            )
            session.add(advisor)
            session.commit()
            logger.info(f"{_rid()}创建顾问：{username} {name}")
            audit("advisor.create", user, info=info, target=f"advisor#{advisor.id}",
                  detail=f"账号={username} 姓名={name}")
            return _resp(200, "success", {"advisorId": advisor.id})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_advisor_update(info: Info, data: ManageAdvisorUpdateInput) -> ApiResponse:
    """更新顾问档案（留空字段不变；status/accepting 同步控制）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == data.advisor_id))
            if not advisor:
                return _resp(404, "顾问不存在")
            # 数据域：advisor 只能修改本人档案
            if user.role == "advisor" and advisor.username != user.username:
                return _resp(403, "仅可修改本人档案")
            now = datetime.now()
            if data.name.strip():
                advisor.name = data.name.strip()
            if data.email.strip():
                advisor.email = data.email.strip()
            if data.grade.strip():
                advisor.grade = data.grade.strip()
            if data.major.strip():
                advisor.major = data.major.strip()
            if data.direction.strip():
                advisor.direction = data.direction.strip()
            if data.bio.strip():
                advisor.bio = data.bio.strip()
            if data.photo:
                advisor.photo = data.photo
            if data.status in ("1", "0"):
                advisor.status = data.status
            if data.accepting in ("1", "0"):
                advisor.accepting = data.accepting
            advisor.update_time = now
            session.commit()
            audit("advisor.update", user, info=info, target=f"advisor#{advisor.id}",
                  detail=f"姓名={advisor.name}")
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_advisor_delete(info: Info, data: ManageAdvisorIdInput) -> ApiResponse:
    """删除顾问（仅 admin）：有预约记录时拒绝并提示改用停用；连带删除排期（不涉及 pa_user）。"""
    user = _verify_admin(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == data.advisor_id))
            if not advisor:
                return _resp(404, "顾问不存在")
            appointment_count = _count(session, select(PaAppointment).where(
                PaAppointment.advisor_id == advisor.id
            ))
            if appointment_count > 0:
                return _resp(403, "该顾问存在预约记录，不可删除，请改为停用")
            session.execute(delete(PaSlot).where(PaSlot.advisor_id == advisor.id))
            session.execute(delete(PaAdvisor).where(PaAdvisor.id == advisor.id))
            session.commit()
            logger.info(f"{_rid()}删除顾问：{advisor.name}")
            audit("advisor.delete", user, info=info, target=f"advisor#{advisor.id}",
                  detail=f"姓名={advisor.name}")
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")



# ---------------------------
# 管理后台 · 权限管理（顾问 SSO 登录白名单）
# ---------------------------
def view_manage_allow_list(info: Info, data: ManageAllowListInput) -> ApiResponse:
    """顾问 SSO 登录白名单列表（分页，keyword 匹配邮箱，仅 admin）。"""
    if not _verify_admin(info):
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            page, page_size = _clamp_page(data.page, data.page_size)
            query = select(PaAdvisorAllow)
            keyword = data.keyword.strip()
            if keyword:
                query = query.where(PaAdvisorAllow.email.contains(keyword))
            total = _count(session, query)
            rows = session.execute(
                query.order_by(desc(PaAdvisorAllow.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).scalars().all()
            detail = [{
                "allowId": row.id,
                "email": row.email,
                "allow": "1" if row.allow else "0",
                "createTime": row.create_time.strftime("%Y-%m-%d %H:%M:%S") if row.create_time else "",
                "updateTime": row.update_time.strftime("%Y-%m-%d %H:%M:%S") if row.update_time else "",
            } for row in rows]
            return _resp(200, "success", {"total": total, "list": detail})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_allow_create(info: Info, data: ManageAllowCreateInput) -> ApiResponse:
    """新增白名单记录（邮箱唯一，不区分大小写）。"""
    user = _verify_admin(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            email = data.email.strip()
            if not email:
                return _resp(400, "邮箱不能为空")
            existing = _first(session, select(PaAdvisorAllow.id).where(
                func.lower(PaAdvisorAllow.email) == email.lower()
            ))
            if existing:
                return _resp(403, "该邮箱已在白名单中")
            entry = PaAdvisorAllow(email=email, allow=data.allow != "0")
            session.add(entry)
            session.commit()
            logger.info(f"{_rid()}新增白名单：{email} allow={entry.allow}")
            audit("allow.create", user, info=info, target=f"allow#{entry.id}",
                  detail=f"邮箱={email} 允许={'是' if entry.allow else '否'}")
            return _resp(200, "success", {"allowId": entry.id})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_allow_update(info: Info, data: ManageAllowUpdateInput) -> ApiResponse:
    """更新白名单记录（邮箱留空不变；allow 传 1/0，留空不变）。"""
    user = _verify_admin(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            entry = _first(session, select(PaAdvisorAllow).where(PaAdvisorAllow.id == data.allow_id))
            if not entry:
                return _resp(404, "白名单记录不存在")
            email = data.email.strip()
            if email and email.lower() != entry.email.lower():
                conflict = _first(session, select(PaAdvisorAllow.id).where(
                    func.lower(PaAdvisorAllow.email) == email.lower(),
                    PaAdvisorAllow.id != entry.id,
                ))
                if conflict:
                    return _resp(403, "该邮箱已在白名单中")
            if email:
                entry.email = email
            if data.allow in ("1", "0"):
                entry.allow = data.allow == "1"
            entry.update_time = datetime.now()
            session.commit()
            audit("allow.update", user, info=info, target=f"allow#{entry.id}",
                  detail=f"邮箱={entry.email} 允许={'是' if entry.allow else '否'}")
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_allow_delete(info: Info, data: ManageAllowIdInput) -> ApiResponse:
    """删除白名单记录（移除后该顾问邮箱将无法 SSO 登录）。"""
    user = _verify_admin(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            entry = _first(session, select(PaAdvisorAllow).where(PaAdvisorAllow.id == data.allow_id))
            if not entry:
                return _resp(404, "白名单记录不存在")
            email = entry.email
            session.execute(delete(PaAdvisorAllow).where(PaAdvisorAllow.id == entry.id))
            session.commit()
            logger.info(f"{_rid()}删除白名单：{email}")
            audit("allow.delete", user, info=info, target=f"allow#{data.allow_id}",
                  detail=f"邮箱={email}")
            return _resp(200, "success")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


# ---------------------------
# 管理后台 · 预约 / 反馈 / 统计 / 邮件日志
# ---------------------------
def view_manage_appointment_list(info: Info, data: ManageAppointmentListInput) -> ApiResponse:
    """全量预约明细（可按顾问/日期/状态筛选；advisor 仅见本人数据）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            # 数据域：advisor 强制限定本人（忽略入参 advisorId），admin 不限制
            scope_id, err = _manage_scope_advisor_id(session, user)
            if scope_id < 0:
                return _resp(400, err)
            page, page_size = _clamp_page(data.page, data.page_size)
            now = datetime.now()
            query = select(PaAppointment, PaSlot).join(
                PaSlot, PaAppointment.slot_id == PaSlot.id
            )
            advisor_filter = scope_id or _to_int(data.advisor_id)
            if advisor_filter:
                query = query.where(PaAppointment.advisor_id == advisor_filter)
            if data.date.strip():
                day = _day_range(data.date)
                if not day:
                    return _resp(400, "日期格式不合法（YYYY-MM-DD）")
                query = query.where(PaSlot.start_time >= day[0], PaSlot.start_time < day[1])
            if data.state in VALID_APPOINTMENT_STATES:
                query = query.where(PaAppointment.state == data.state)
            total = _count(session, query)
            rows = session.execute(
                query.order_by(desc(PaSlot.start_time), desc(PaAppointment.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).all()
            detail = []
            for appt, slot in rows:
                advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == appt.advisor_id))
                detail.append(_advisor_appointment_item(
                    session, appt, slot, now,
                    advisor_name=advisor.name if advisor else "N/A",
                ))
            return _resp(200, "success", {"total": total, "list": detail})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_feedback_list(info: Info, data: ManageFeedbackListInput) -> ApiResponse:
    """反馈列表（可按顾问/月份筛选；advisor 仅见本人数据）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            # 数据域：advisor 强制限定本人（忽略入参 advisorId），admin 不限制
            scope_id, err = _manage_scope_advisor_id(session, user)
            if scope_id < 0:
                return _resp(400, err)
            page, page_size = _clamp_page(data.page, data.page_size)
            query = (
                select(PaFeedback, PaAppointment, PaSlot)
                .join(PaAppointment, PaFeedback.appointment_id == PaAppointment.id)
                .join(PaSlot, PaAppointment.slot_id == PaSlot.id)
            )
            advisor_filter = scope_id or _to_int(data.advisor_id)
            if advisor_filter:
                query = query.where(PaFeedback.advisor_id == advisor_filter)
            if data.month.strip():
                rng = _month_range(data.month)
                if not rng:
                    return _resp(400, "月份格式不合法（YYYY-MM）")
                query = query.where(PaSlot.start_time >= rng[0], PaSlot.start_time < rng[1])
            total = _count(session, query)
            rows = session.execute(
                query.order_by(desc(PaSlot.start_time), desc(PaFeedback.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).all()
            detail = []
            for feedback, appt, slot in rows:
                advisor = _first(session, select(PaAdvisor).where(
                    PaAdvisor.id == feedback.advisor_id
                ))
                detail.append({
                    "feedbackId": feedback.id,
                    "appointmentId": appt.id,
                    "applyNo": appt.apply_no,
                    "advisorName": advisor.name if advisor else "N/A",
                    "studentName": appt.student_name,
                    "studentNo": appt.student_no,
                    "startTime": _fmt_dt(slot.start_time),
                    "topic": appt.topic,
                    "summary": feedback.summary,
                    "handle": feedback.handle,
                    "needFollowup": feedback.need_followup,
                    "createTime": _fmt_dt(feedback.update_time or feedback.create_time,
                                          "%Y-%m-%d %H:%M:%S"),
                })
            return _resp(200, "success", {"total": total, "list": detail})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_stats(info: Info) -> ApiResponse:
    """运营统计：总量/完成/取消/进行中 + 各顾问咨询量排名（advisor 仅本人口径）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            # 数据域：advisor 各项指标与排名均只统计本人预约，admin 为全量
            scope_id, err = _manage_scope_advisor_id(session, user)
            if scope_id < 0:
                return _resp(400, err)
            base = select(PaAppointment)
            if scope_id:
                base = base.where(PaAppointment.advisor_id == scope_id)
            total = _count(session, base)
            completed = _count(session, base.where(
                PaAppointment.state == "completed"
            ))
            cancelled = _count(session, base.where(
                PaAppointment.state.in_(("cancelled_student", "cancelled_advisor"))
            ))
            booked = _count(session, base.where(
                PaAppointment.state == "booked"
            ))
            # 各顾问咨询量（全部预约）与完成量，按咨询量降序
            count_query = select(PaAppointment.advisor_id, func.count(PaAppointment.id))
            completed_query = (
                select(PaAppointment.advisor_id, func.count(PaAppointment.id))
                .where(PaAppointment.state == "completed")
            )
            if scope_id:
                count_query = count_query.where(PaAppointment.advisor_id == scope_id)
                completed_query = completed_query.where(PaAppointment.advisor_id == scope_id)
            count_rows = session.execute(
                count_query.group_by(PaAppointment.advisor_id)
            ).all()
            completed_map = dict(session.execute(
                completed_query.group_by(PaAppointment.advisor_id)
            ).all())
            ranking = []
            for advisor_id, count in sorted(count_rows, key=lambda r: -r[1]):
                advisor = _first(session, select(PaAdvisor).where(PaAdvisor.id == advisor_id))
                ranking.append({
                    "advisorName": advisor.name if advisor else "N/A",
                    "count": int(count),
                    "completed": int(completed_map.get(advisor_id, 0)),
                })
            return _resp(200, "success", {
                "total": total,
                "completed": completed,
                "cancelled": cancelled,
                "booked": booked,
                "ranking": ranking,
            })
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_email_log_list(info: Info, data: ManageEmailLogListInput) -> ApiResponse:
    """邮件发送日志（分页，可按类型筛选；advisor 仅见本人预约关联的邮件）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            page, page_size = _clamp_page(data.page, data.page_size)
            query = select(PaEmailLog)
            # 数据域：advisor 只能看到本人预约关联的邮件（admin 不限制）
            scope_id, err = _manage_scope_advisor_id(session, user)
            if scope_id < 0:
                return _resp(400, err)
            if scope_id:
                query = query.where(PaEmailLog.appointment_id.in_(
                    select(PaAppointment.id).where(PaAppointment.advisor_id == scope_id)
                ))
            if data.mail_type.strip():
                query = query.where(PaEmailLog.mail_type == data.mail_type.strip())
            total = _count(session, query)
            objs = session.execute(
                query.order_by(desc(PaEmailLog.id))
                .offset((page - 1) * page_size).limit(page_size)
            ).scalars().all()
            detail = [{
                "id": obj.id,
                "mailTo": obj.mail_to,
                "mailType": obj.mail_type,
                "subject": obj.subject,
                "content": obj.content,
                "status": obj.status,
                "error": obj.error,
                "appointmentId": obj.appointment_id,
                "createTime": _fmt_dt(obj.create_time, "%Y-%m-%d %H:%M:%S"),
            } for obj in objs]
            return _resp(200, "success", {"total": total, "list": detail})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def _filtered_appointment_rows(session, advisor_id: Any, month: str):
    """导出公共查询：全量预约（可按顾问/月份过滤），返回 (appointment, slot) 行列表或错误消息。"""
    query = select(PaAppointment, PaSlot).join(PaSlot, PaAppointment.slot_id == PaSlot.id)
    if _to_int(advisor_id):
        query = query.where(PaAppointment.advisor_id == int(advisor_id))
    if str(month or "").strip():
        rng = _month_range(month)
        if not rng:
            return None, "月份格式不合法（YYYY-MM）"
        query = query.where(PaSlot.start_time >= rng[0], PaSlot.start_time < rng[1])
    rows = session.execute(
        query.order_by(desc(PaSlot.start_time), desc(PaAppointment.id))
    ).all()
    return rows, ""


def view_manage_appointment_export(info: Info, data: ManageExportInput) -> FileResponse:
    """管理端全量预约导出（可按顾问/月份过滤；advisor 仅导出本人数据）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return FileResponse(code=401, msg="Token Error")
    maker = get_session()
    with maker() as session:
        try:
            # 数据域：advisor 强制限定本人（忽略入参 advisorId），admin 不限制
            scope_id, scope_err = _manage_scope_advisor_id(session, user)
            if scope_id < 0:
                return FileResponse(code=400, msg=scope_err)
            rows, err = _filtered_appointment_rows(
                session, scope_id or data.advisor_id, data.month
            )
            if rows is None:
                return FileResponse(code=400, msg=err)
            wb = Workbook()
            ws = wb.active
            header = ["序号", "预约单号", "顾问", "学生姓名", "学号", "邮箱",
                      "开始时间", "结束时间",
                      "咨询主题", "咨询内容", "方式", "电话", "微信", "会议链接",
                      "状态", "取消原因", "创建时间"]
            ws.append(header)
            _append_appointment_rows(session, ws, rows)
            _style_header_row(ws, len(header))
            audit("export.appointments", user, info=info,
                  detail=f"advisor_id={data.advisor_id} month={data.month} 共 {len(rows)} 行")
            return _workbook_to_file(wb, "AppointmentExport.xlsx")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return FileResponse(code=500, msg="服务器错误")


def view_manage_feedback_export(info: Info, data: ManageExportInput) -> FileResponse:
    """反馈汇总导出（可按顾问/月份过滤；advisor 仅导出本人数据）。"""
    user = _verify_admin_or_advisor(info)
    if not user:
        return FileResponse(code=401, msg="Token Error")
    maker = get_session()
    with maker() as session:
        try:
            # 数据域：advisor 强制限定本人（忽略入参 advisorId），admin 不限制
            scope_id, scope_err = _manage_scope_advisor_id(session, user)
            if scope_id < 0:
                return FileResponse(code=400, msg=scope_err)
            query = (
                select(PaFeedback, PaAppointment, PaSlot)
                .join(PaAppointment, PaFeedback.appointment_id == PaAppointment.id)
                .join(PaSlot, PaAppointment.slot_id == PaSlot.id)
            )
            advisor_filter = scope_id or _to_int(data.advisor_id)
            if advisor_filter:
                query = query.where(PaFeedback.advisor_id == advisor_filter)
            if data.month.strip():
                rng = _month_range(data.month)
                if not rng:
                    return FileResponse(code=400, msg="月份格式不合法（YYYY-MM）")
                query = query.where(PaSlot.start_time >= rng[0], PaSlot.start_time < rng[1])
            rows = session.execute(
                query.order_by(desc(PaSlot.start_time), desc(PaFeedback.id))
            ).all()
            wb = Workbook()
            ws = wb.active
            header = ["序号", "预约单号", "顾问", "学生姓名", "学号", "咨询时间",
                      "咨询主题", "咨询总结", "处理方式", "是否跟进", "填写时间"]
            ws.append(header)
            row_num = 0
            for feedback, appt, slot in rows:
                advisor = _first(session, select(PaAdvisor).where(
                    PaAdvisor.id == feedback.advisor_id
                ))
                row_num += 1
                ws.append([
                    row_num,
                    appt.apply_no,
                    advisor.name if advisor else "N/A",
                    appt.student_name,
                    appt.student_no,
                    _fmt_dt(slot.start_time),
                    appt.topic,
                    feedback.summary,
                    feedback.handle,
                    "是" if feedback.need_followup == "1" else "否",
                    _fmt_dt(feedback.update_time or feedback.create_time, "%Y-%m-%d %H:%M:%S"),
                ])
            _style_header_row(ws, len(header))
            audit("export.feedback", user, info=info,
                  detail=f"advisor_id={data.advisor_id} month={data.month} 共 {len(rows)} 行")
            return _workbook_to_file(wb, "FeedbackExport.xlsx")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return FileResponse(code=500, msg="服务器错误")


def view_manage_mail_template_list(info: Info) -> ApiResponse:
    """邮件模板列表（仅 admin，模板为全局配置非顾问个人数据）：三类模板全量返回，缺失类型以内置默认补齐展示。"""
    if not _verify_admin(info):
        return _resp(401, "Token Error")
    maker = get_session()
    with maker() as session:
        try:
            objs = session.execute(select(PaMailTemplate)).scalars().all()
            by_type = {obj.mail_type: obj for obj in objs}
            detail = []
            for mail_type, tpl in DEFAULT_TEMPLATES.items():
                obj = by_type.get(mail_type)
                detail.append({
                    "mailType": mail_type,
                    "subject": obj.subject if obj else tpl["subject"],
                    "html": obj.html if obj else tpl["html"],
                    "updateTime": _fmt_dt(obj.update_time, "%Y-%m-%d %H:%M:%S") if obj else "",
                })
            return _resp(200, "success", {"list": detail})
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")


def view_manage_mail_template_update(info: Info, data: ManageMailTemplateUpdateInput) -> ApiResponse:
    """邮件模板更新（仅 admin，模板为全局配置非顾问个人数据）：按类型 upsert 主题与正文 HTML。"""
    user = _verify_admin(info)
    if not user:
        return _resp(401, "Token Error")
    mail_type = data.mail_type.strip()
    subject = data.subject.strip()
    html = data.html.strip()
    if mail_type not in DEFAULT_TEMPLATES:
        return _resp(400, "邮件类型不合法（booked/cancelled/reminder）")
    if not subject or not html:
        return _resp(400, "主题与正文均不能为空")
    maker = get_session()
    with maker() as session:
        try:
            obj = session.execute(
                select(PaMailTemplate).where(PaMailTemplate.mail_type == mail_type)
            ).scalars().first()
            now = datetime.now()
            if obj:
                obj.subject = subject
                obj.html = html
                obj.update_time = now
            else:
                session.add(PaMailTemplate(
                    mail_type=mail_type, subject=subject, html=html,
                    create_time=now, update_time=now,
                ))
            session.commit()
            logger.info(f"{_rid()}管理员更新邮件模板 {mail_type}")
            audit("mail_template.update", user, info=info, target=mail_type)
            return _resp(200, "更新成功")
        except Exception as e:
            logger.error(f"{_rid()}{e}")
            session.rollback()
            return _resp(500, "服务器错误")
