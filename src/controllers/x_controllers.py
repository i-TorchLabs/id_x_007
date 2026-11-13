"""路由层：thin resolvers，只做参数透传，委托到 views。"""
from __future__ import annotations

import strawberry
from litestar import Router
from strawberry.extensions import DisableIntrospection, QueryDepthLimiter
from strawberry.litestar import make_graphql_controller
from strawberry.types import Info

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
from x_models.id_x_007.src.views import x_views


@strawberry.type
class Query:
    @strawberry.field(description="健康检查")
    def health(self, info: Info) -> HealthType:
        return x_views.view_health(info)

    @strawberry.field(description="登录传输加密公钥（RSA-2048 PEM，前端加密用户名/密码用）")
    def login_key(self, info: Info) -> LoginKeyType:
        return x_views.view_login_key(info)

    # ----- 学生端 · 顾问浏览 -----
    @strawberry.field(description="顾问卡片列表（登录即可；含每人未来可约时段 ≤5 条与专业/方向筛选项）")
    def advisor_list(self, info: Info, data: AdvisorListInput) -> ApiResponse:
        return x_views.view_advisor_list(info, data)

    @strawberry.field(description="指定顾问的全部可约时段（登录即可）")
    def advisor_slot_list(self, info: Info, data: AdvisorIdInput) -> ApiResponse:
        return x_views.view_advisor_slot_list(info, data)

    @strawberry.field(description="我的预约列表（本人，分页，附可取消标记）")
    def my_appointment_list(self, info: Info, data: PageInput) -> ApiResponse:
        return x_views.view_my_appointment_list(info, data)

    # ----- 排期与预约（advisor 本人 / admin 代管） -----
    @strawberry.field(description="排期列表（advisor 本人或 admin 代管，admin 须指定 advisorId；含暂停时段）")
    def advisor_my_slot_list(self, info: Info, data: AdvisorPageInput) -> ApiResponse:
        return x_views.view_advisor_my_slot_list(info, data)

    @strawberry.field(description="批量排期模板下载（xlsx：日期/开始时间/结束时间）")
    def advisor_slot_template(self, info: Info) -> FileResponse:
        return x_views.view_advisor_slot_template(info)

    @strawberry.field(description="顾问预约明细（advisor 仅本人；admin 代管须指定 advisorId；可按日期/状态筛选）")
    def advisor_appointment_list(self, info: Info, data: ManageAppointmentListInput) -> ApiResponse:
        return x_views.view_advisor_appointment_list(info, data)

    @strawberry.field(description="顾问个人历史预约导出（advisor 仅本人；admin 代管须指定 advisorId；可按月份过滤）")
    def advisor_appointment_export(self, info: Info, data: ManageExportInput) -> FileResponse:
        return x_views.view_advisor_appointment_export(info, data)

    # ----- 管理后台 -----
    @strawberry.field(description="顾问列表（分页，keyword 匹配姓名/用户名/专业/方向；admin 全量 / advisor 仅本人档案）")
    def manage_advisor_list(self, info: Info, data: ManageAdvisorListInput) -> ApiResponse:
        return x_views.view_manage_advisor_list(info, data)

    @strawberry.field(description="顾问 SSO 登录白名单列表（分页，keyword 匹配邮箱，仅 admin）")
    def manage_allow_list(self, info: Info, data: ManageAllowListInput) -> ApiResponse:
        return x_views.view_manage_allow_list(info, data)

    @strawberry.field(description="预约明细（可按顾问/日期/状态筛选；admin 全量 / advisor 仅本人数据）")
    def manage_appointment_list(self, info: Info, data: ManageAppointmentListInput) -> ApiResponse:
        return x_views.view_manage_appointment_list(info, data)

    @strawberry.field(description="反馈列表（可按顾问/月份筛选；admin 全量 / advisor 仅本人数据）")
    def manage_feedback_list(self, info: Info, data: ManageFeedbackListInput) -> ApiResponse:
        return x_views.view_manage_feedback_list(info, data)

    @strawberry.field(description="运营统计：总量/完成/取消/进行中 + 咨询量排名（admin 全量 / advisor 仅本人口径）")
    def manage_stats(self, info: Info) -> ApiResponse:
        return x_views.view_manage_stats(info)

    @strawberry.field(description="邮件发送日志（可按类型筛选；admin 全量 / advisor 仅本人预约关联）")
    def manage_email_log_list(self, info: Info, data: ManageEmailLogListInput) -> ApiResponse:
        return x_views.view_manage_email_log_list(info, data)

    @strawberry.field(description="邮件模板列表（仅 admin；booked/cancelled/reminder 三类）")
    def manage_mail_template_list(self, info: Info) -> ApiResponse:
        return x_views.view_manage_mail_template_list(info)

    @strawberry.field(description="预约导出（可按顾问/月份过滤；admin 全量 / advisor 仅本人数据）")
    def manage_appointment_export(self, info: Info, data: ManageExportInput) -> FileResponse:
        return x_views.view_manage_appointment_export(info, data)

    @strawberry.field(description="反馈汇总导出（可按顾问/月份过滤；admin 全量 / advisor 仅本人数据）")
    def manage_feedback_export(self, info: Info, data: ManageExportInput) -> FileResponse:
        return x_views.view_manage_feedback_export(info, data)


@strawberry.type
class Mutation:
    # ----- 认证 -----
    @strawberry.mutation(description="账号密码登录（仅 admin，student/advisor 走 SSO；RSA 加密凭据/验证码/防爆破锁定）")
    def login(self, info: Info, data: LoginInput) -> ApiResponse:
        return x_views.view_login(info, data)

    @strawberry.mutation(description="管理员注册（邮箱即登录用户名；注册后 is_active=False，须运维登库激活后方可登录）")
    def register(self, info: Info, data: RegisterInput) -> ApiResponse:
        return x_views.view_register(info, data)

    @strawberry.mutation(description="登出")
    def logout(self, info: Info, data: LogoutInput) -> ApiResponse:
        return x_views.view_logout(info, data)

    @strawberry.mutation(description="CUHK SSO 登录（ADFS 授权码流；顾问入口（portal=advisor）须过 pa_advisor_allow 白名单、通过后签发 advisor 会话进入管理后台；学生入口不校验白名单、按顾问档案定 advisor/student；首次登录自动建档）")
    def oauth_login(self, info: Info, data: OauthInput) -> ApiResponse:
        return x_views.view_oauth_login(info, data)

    # ----- 学生端 · 预约 -----
    @strawberry.mutation(description="学生预约（仅 student；24h 截止/行锁占用校验/重复预约拦截/双方邮件通知）")
    def student_appointment_create(self, info: Info, data: AppointmentCreateInput) -> ApiResponse:
        return x_views.view_student_appointment_create(info, data)

    @strawberry.mutation(description="学生取消预约（须填取消原因；开始前 4 小时内禁止；双方邮件通知）")
    def student_appointment_cancel(self, info: Info, data: AppointmentIdInput) -> ApiResponse:
        return x_views.view_student_appointment_cancel(info, data)

    # ----- 排期管理（advisor 本人 / admin 代管） -----
    @strawberry.mutation(description="新增咨询时段（advisor 本人或 admin 代管，admin 须指定 advisorId）")
    def advisor_slot_create(self, info: Info, data: SlotCreateInput) -> ApiResponse:
        return x_views.view_advisor_slot_create(info, data)

    @strawberry.mutation(description="修改咨询时段（起止时间，advisor 本人或 admin 代管）")
    def advisor_slot_update(self, info: Info, data: SlotUpdateInput) -> ApiResponse:
        return x_views.view_advisor_slot_update(info, data)

    @strawberry.mutation(description="删除咨询时段（存在有效预约时拒绝，advisor 本人或 admin 代管）")
    def advisor_slot_delete(self, info: Info, data: SlotIdInput) -> ApiResponse:
        return x_views.view_advisor_slot_delete(info, data)

    @strawberry.mutation(description="暂停/恢复咨询时段（advisor 本人或 admin 代管）")
    def advisor_slot_state(self, info: Info, data: SlotStateInput) -> ApiResponse:
        return x_views.view_advisor_slot_state(info, data)

    @strawberry.mutation(description="批量上传排期（xlsx，逐行校验并返回成功/失败行报告，advisor 本人或 admin 代管）")
    def advisor_slot_batch_upload(self, info: Info, data: SlotBatchUploadInput) -> ApiResponse:
        return x_views.view_advisor_slot_batch_upload(info, data)

    @strawberry.mutation(description="设置顾问「暂不接待」整体开关（advisor 本人或 admin 代管）")
    def advisor_accepting_set(self, info: Info, data: AcceptingSetInput) -> ApiResponse:
        return x_views.view_advisor_accepting_set(info, data)

    # ----- 预约处理与反馈（advisor 本人 / admin 代管） -----
    @strawberry.mutation(description="顾问取消预约（advisor 本人或 admin 代管；须填原因；开始前 4 小时内禁止；双方邮件通知）")
    def advisor_appointment_cancel(self, info: Info, data: AdvisorCancelInput) -> ApiResponse:
        return x_views.view_advisor_appointment_cancel(info, data)

    @strawberry.mutation(description="标记咨询完成（开始时间已过方可标记，advisor 本人或 admin 代管）")
    def advisor_appointment_complete(self, info: Info, data: AdvisorCompleteInput) -> ApiResponse:
        return x_views.view_advisor_appointment_complete(info, data)

    @strawberry.mutation(description="填写/更新咨询反馈（仅 completed 预约，upsert，advisor 本人或 admin 代管）")
    def feedback_set(self, info: Info, data: FeedbackSetInput) -> ApiResponse:
        return x_views.view_feedback_set(info, data)

    # ----- 管理后台 · 顾问管理 -----
    @strawberry.mutation(description="创建顾问（仅建顾问档案，不建用户账号，仅 admin）")
    def manage_advisor_create(self, info: Info, data: ManageAdvisorCreateInput) -> ApiResponse:
        return x_views.view_manage_advisor_create(info, data)

    @strawberry.mutation(description="更新顾问档案（留空字段不变；admin 任意 / advisor 仅本人档案）")
    def manage_advisor_update(self, info: Info, data: ManageAdvisorUpdateInput) -> ApiResponse:
        return x_views.view_manage_advisor_update(info, data)

    @strawberry.mutation(description="删除顾问（有预约记录时拒绝并提示停用，仅 admin）")
    def manage_advisor_delete(self, info: Info, data: ManageAdvisorIdInput) -> ApiResponse:
        return x_views.view_manage_advisor_delete(info, data)

    # ----- 管理后台 · 权限管理（顾问 SSO 登录白名单） -----
    @strawberry.mutation(description="新增白名单记录（邮箱唯一，仅 admin）")
    def manage_allow_create(self, info: Info, data: ManageAllowCreateInput) -> ApiResponse:
        return x_views.view_manage_allow_create(info, data)

    @strawberry.mutation(description="更新白名单记录（邮箱/允许状态，留空不变，仅 admin）")
    def manage_allow_update(self, info: Info, data: ManageAllowUpdateInput) -> ApiResponse:
        return x_views.view_manage_allow_update(info, data)

    @strawberry.mutation(description="删除白名单记录（仅 admin）")
    def manage_allow_delete(self, info: Info, data: ManageAllowIdInput) -> ApiResponse:
        return x_views.view_manage_allow_delete(info, data)

    @strawberry.mutation(description="邮件模板更新（仅 admin；按类型 upsert 主题与正文）")
    def manage_mail_template_update(self, info: Info, data: ManageMailTemplateUpdateInput) -> ApiResponse:
        return x_views.view_manage_mail_template_update(info, data)


# 安全加固（复刻 id_x_003 漏洞报告 #1 修复）：
# - DisableIntrospection：关闭 introspection，防止攻击者获取完整 schema
# - QueryDepthLimiter：限制查询深度，防止深层嵌套查询造成 DoS
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=[
        DisableIntrospection(),
        QueryDepthLimiter(max_depth=8),
    ],
)


def register_routers(route_prefix: str) -> Router:
    # 安全加固（复刻 id_x_003 漏洞报告 #1 补充）：
    # - graphql_ide=None：禁止对外暴露 GraphiQL 交互式 IDE，避免泄露 schema 线索
    # - allow_queries_via_get=False：仅接受 POST 查询，杜绝 GET/URL 直达与缓存投毒
    controller = make_graphql_controller(
        schema,
        path="/graphql",
        graphql_ide=None,
        allow_queries_via_get=False,
    )
    return Router(path=route_prefix, route_handlers=[controller])
