"""契约层：Strawberry GraphQL Input/Type 纯类型定义，不含任何业务逻辑。

UGO 朋辈顾问咨询预约系统（id_x_007）：字段经 strawberry 自动转为 camelCase
（如 page_size → pageSize、advisor_id → advisorId），与前端契约一致。
"""
from __future__ import annotations

import strawberry
from strawberry.scalars import JSON


# ===== 通用 =====
@strawberry.type
class HealthType:
    status: str = strawberry.field(description="服务状态")
    service: str = strawberry.field(description="服务名")


@strawberry.type
class ApiResponse:
    """统一业务响应：code/msg/data，data 为 JSON 载荷。"""
    code: int = strawberry.field(description="状态码")
    msg: str = strawberry.field(description="消息")
    data: JSON = strawberry.field(default_factory=dict, description="业务数据")


@strawberry.type
class FileResponse:
    """文件下载响应：以 base64 承载文件内容。"""
    code: int = strawberry.field(description="状态码")
    msg: str = strawberry.field(description="消息")
    file_name: str = strawberry.field(default="", description="文件名")
    file_base64: str = strawberry.field(default="", description="文件内容（base64）")


# ===== 认证 =====
@strawberry.type
class LoginKeyType:
    """登录传输加密公钥：前端用其 RSA-OAEP(SHA-256) 加密用户名/密码后再提交。"""
    public_key: str = strawberry.field(description="RSA-2048 公钥（PEM）")
    algorithm: str = strawberry.field(default="RSA-OAEP-SHA256", description="加密算法标识")


@strawberry.input
class LoginInput:
    username: str = strawberry.field(description="用户名（encrypted=true 时为 RSA 密文 base64）")
    password: str = strawberry.field(description="密码（encrypted=true 时为 RSA 密文 base64）")
    encrypted: bool = strawberry.field(default=False, description="用户名/密码是否经 loginKey 公钥加密")
    captcha_id: str = strawberry.field(default="", description="验证码ID（触发验证码后必填）")
    captcha_code: str = strawberry.field(default="", description="验证码答案（触发验证码后必填）")


@strawberry.input
class RegisterInput:
    """管理员自助注册（邮箱即登录用户名；注册后 is_active=False，须运维登库激活后方可登录）。"""
    email: str = strawberry.field(description="邮箱（作为登录用户名）")
    password: str = strawberry.field(description="密码")
    name: str = strawberry.field(description="姓名")


@strawberry.input
class LogoutInput:
    user_id: int = strawberry.field(description="用户ID")


@strawberry.input
class OauthInput:
    """CUHK SSO 登录入参：ADFS 授权码授予流（student / advisor）。

    - 优先使用 code（授权码，服务端用 client_secret 换 id_token，最安全）；
    - oauth_token 仅为旧隐式流兼容保留，新流程不应使用。
    """
    code: str = strawberry.field(default="", description="ADFS 授权码（response_type=code 回调获得）")
    oauth_token: str = strawberry.field(default="", description="[已废弃] 旧隐式流 access_token")


# ===== 通用分页 =====
@strawberry.input
class PageInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")


# ===== 学生端 · 顾问与预约 =====
@strawberry.input
class AdvisorListInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")
    major: str = strawberry.field(default="", description="专业筛选")
    direction: str = strawberry.field(default="", description="擅长方向筛选")


@strawberry.input
class AdvisorIdInput:
    advisor_id: int = strawberry.field(description="顾问ID")


@strawberry.input
class AppointmentCreateInput:
    slot_id: int = strawberry.field(description="时段ID")
    topic: str = strawberry.field(description="咨询主题（必填）")
    content: str = strawberry.field(description="咨询内容（必填）")
    mode: str = strawberry.field(description="咨询方式（online线上/offline线下）")
    phone: str = strawberry.field(description="电话（必填）")
    wechat: str = strawberry.field(default="", description="微信号（线上必填/线下选填）")
    meeting_link: str = strawberry.field(default="", description="会议链接（线上选填/线下不填）")


@strawberry.input
class AppointmentIdInput:
    appointment_id: int = strawberry.field(description="预约ID")


# ===== 顾问端 · 排期与预约管理 =====
@strawberry.input
class AdvisorPageInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填，advisor 忽略取本人）")


@strawberry.input
class AdvisorAppointmentListInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")
    state: str = strawberry.field(default="", description="状态筛选（booked/cancelled_student/cancelled_advisor/completed）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填，advisor 忽略取本人）")


@strawberry.input
class SlotCreateInput:
    start_time: str = strawberry.field(description="开始时间（毫秒时间戳或 YYYY-MM-DD HH:MM）")
    end_time: str = strawberry.field(description="结束时间（毫秒时间戳或 YYYY-MM-DD HH:MM）")
    quota: int = strawberry.field(default=1, description="名额（默认 1 人）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class SlotUpdateInput:
    slot_id: int = strawberry.field(description="时段ID")
    start_time: str = strawberry.field(description="开始时间（毫秒时间戳或 YYYY-MM-DD HH:MM）")
    end_time: str = strawberry.field(description="结束时间（毫秒时间戳或 YYYY-MM-DD HH:MM）")
    quota: int = strawberry.field(default=1, description="名额（不得小于已订数）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class SlotIdInput:
    slot_id: int = strawberry.field(description="时段ID")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class SlotStateInput:
    slot_id: int = strawberry.field(description="时段ID")
    state: str = strawberry.field(description="状态（1开放/0暂停）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class SlotBatchUploadInput:
    file_name: str = strawberry.field(description="文件名（.xlsx）")
    file_base64: str = strawberry.field(description="文件内容（base64）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class AcceptingSetInput:
    accepting: str = strawberry.field(description="接待状态（1接待/0暂不接待）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class AdvisorCancelInput:
    appointment_id: int = strawberry.field(description="预约ID")
    reason: str = strawberry.field(description="取消原因（必填）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class AdvisorCompleteInput:
    appointment_id: int = strawberry.field(description="预约ID")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class FeedbackSetInput:
    appointment_id: int = strawberry.field(description="预约ID（须为 completed 状态）")
    summary: str = strawberry.field(description="咨询总结")
    handle: str = strawberry.field(description="处理方式")
    need_followup: str = strawberry.field(default="0", description="是否需要跟进（1是/0否）")
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填）")


@strawberry.input
class AdvisorExportInput:
    advisor_id: int = strawberry.field(default=0, description="顾问ID（admin 代管时必填，advisor 忽略取本人）")


# ===== 管理后台 =====
@strawberry.input
class ManageAdvisorListInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")
    keyword: str = strawberry.field(default="", description="姓名/用户名/专业/方向模糊匹配")


@strawberry.input
class ManageAppointmentListInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")
    advisor_id: int = strawberry.field(default=0, description="顾问ID筛选（0 为全部）")
    date: str = strawberry.field(default="", description="按开始时间过滤（YYYY-MM-DD）")
    state: str = strawberry.field(default="", description="状态筛选")


@strawberry.input
class ManageFeedbackListInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")
    advisor_id: int = strawberry.field(default=0, description="顾问ID筛选（0 为全部）")
    month: str = strawberry.field(default="", description="按咨询月份过滤（YYYY-MM）")


@strawberry.input
class ManageEmailLogListInput:
    page: int = strawberry.field(default=1, description="页码")
    page_size: int = strawberry.field(default=10, description="每页数量")
    mail_type: str = strawberry.field(default="", description="邮件类型筛选（booked/cancelled/reminder）")


@strawberry.input
class ManageExportInput:
    advisor_id: int = strawberry.field(default=0, description="顾问ID筛选（0 为全部）")
    month: str = strawberry.field(default="", description="按咨询月份过滤（YYYY-MM）")


@strawberry.input
class ManageAdvisorCreateInput:
    username: str = strawberry.field(description="用户名（CUHK SSO upn/邮箱，唯一）")
    name: str = strawberry.field(description="姓名")
    email: str = strawberry.field(default="", description="邮箱")
    grade: str = strawberry.field(default="", description="年级")
    major: str = strawberry.field(default="", description="专业")
    direction: str = strawberry.field(default="", description="擅长方向")
    bio: str = strawberry.field(default="", description="个人简介")
    photo: str = strawberry.field(default="", description="照片（base64 data URL）")


@strawberry.input
class ManageAdvisorUpdateInput:
    advisor_id: int = strawberry.field(description="顾问ID")
    name: str = strawberry.field(default="", description="姓名（留空不变）")
    email: str = strawberry.field(default="", description="邮箱（留空不变）")
    grade: str = strawberry.field(default="", description="年级（留空不变）")
    major: str = strawberry.field(default="", description="专业（留空不变）")
    direction: str = strawberry.field(default="", description="擅长方向（留空不变）")
    bio: str = strawberry.field(default="", description="个人简介（留空不变）")
    photo: str = strawberry.field(default="", description="照片（留空不变）")
    status: str = strawberry.field(default="", description="状态（1启用/0停用，留空不变）")
    accepting: str = strawberry.field(default="", description="接待状态（1接待/0暂不接待，留空不变）")


@strawberry.input
class ManageAdvisorIdInput:
    advisor_id: int = strawberry.field(description="顾问ID")


@strawberry.input
class ManageMailTemplateUpdateInput:
    mail_type: str = strawberry.field(description="邮件类型(booked/cancelled/reminder)")
    subject: str = strawberry.field(description="主题模板（支持 {apply_no} 等占位符）")
    html: str = strawberry.field(description="正文 HTML 模板（支持 {apply_no} 等占位符）")
