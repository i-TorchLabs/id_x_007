-- id_x_007 业务库 DDL（幂等）
-- 与 src/models/x_models.py 中 Pa* ORM 模型一一对应。
-- 部署已改为直连外部 PostgreSQL：应用启动时 create_all 自动建表，
-- 本文件仅供手动初始化外部库 / 审阅表结构时参考，非必需执行。

-- 用户表
CREATE TABLE IF NOT EXISTS pa_user (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(255) NOT NULL DEFAULT 'N/A' UNIQUE,
    password    VARCHAR(255) NOT NULL DEFAULT 'N/A',
    "key"       TEXT         NOT NULL DEFAULT 'N/A',
    role        VARCHAR(255) NOT NULL DEFAULT 'student',
    name        VARCHAR(255) NOT NULL DEFAULT 'N/A',
    email       VARCHAR(255) NOT NULL DEFAULT 'N/A',
    state       VARCHAR(255) NOT NULL DEFAULT '1',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    create_time TIMESTAMP    NULL DEFAULT NOW(),
    update_time TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_user IS '用户表';
COMMENT ON COLUMN pa_user.id IS 'ID';
COMMENT ON COLUMN pa_user.username IS '用户名（SSO 用户为 upn/邮箱）';
COMMENT ON COLUMN pa_user.password IS '密码（PBKDF2 哈希，SSO 用户为 N/A）';
COMMENT ON COLUMN pa_user."key" IS '会话密钥（Token）';
COMMENT ON COLUMN pa_user.role IS '角色(student/advisor/admin)';
COMMENT ON COLUMN pa_user.name IS '姓名';
COMMENT ON COLUMN pa_user.email IS '邮箱';
COMMENT ON COLUMN pa_user.state IS '状态(1启用/0停用)';
COMMENT ON COLUMN pa_user.is_active IS '是否已激活（自助注册的 admin 默认 FALSE，须运维手动置 TRUE 后方可登录）';
COMMENT ON COLUMN pa_user.create_time IS '创建时间';
COMMENT ON COLUMN pa_user.update_time IS '更新时间';

-- 档案表
CREATE TABLE IF NOT EXISTS pa_advisor (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(255) NOT NULL DEFAULT 'N/A' UNIQUE,
    name        VARCHAR(255) NOT NULL DEFAULT 'N/A',
    email       VARCHAR(255) NOT NULL DEFAULT 'N/A',
    grade       VARCHAR(255) NOT NULL DEFAULT 'N/A',
    major       VARCHAR(255) NOT NULL DEFAULT 'N/A',
    direction   VARCHAR(255) NOT NULL DEFAULT 'N/A',
    bio         TEXT         NOT NULL DEFAULT 'N/A',
    photo       TEXT         NOT NULL DEFAULT '',
    status      VARCHAR(255) NOT NULL DEFAULT '1',
    accepting   VARCHAR(255) NOT NULL DEFAULT '1',
    create_time TIMESTAMP    NULL DEFAULT NOW(),
    update_time TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_advisor IS '顾问档案表';
COMMENT ON COLUMN pa_advisor.id IS 'ID';
COMMENT ON COLUMN pa_advisor.username IS '账号标识（CUHK 邮箱/upn，SSO 登录据此匹配顾问身份）';
COMMENT ON COLUMN pa_advisor.name IS '姓名';
COMMENT ON COLUMN pa_advisor.email IS '邮箱';
COMMENT ON COLUMN pa_advisor.grade IS '年级';
COMMENT ON COLUMN pa_advisor.major IS '专业';
COMMENT ON COLUMN pa_advisor.direction IS '擅长方向';
COMMENT ON COLUMN pa_advisor.bio IS '个人简介';
COMMENT ON COLUMN pa_advisor.photo IS '照片（base64 data URL）';
COMMENT ON COLUMN pa_advisor.status IS '状态(1启用/0停用)';
COMMENT ON COLUMN pa_advisor.accepting IS '接待状态(1接待/0暂不接待)';
COMMENT ON COLUMN pa_advisor.create_time IS '创建时间';
COMMENT ON COLUMN pa_advisor.update_time IS '更新时间';

-- 顾问 SSO 登录白名单表（仅顾问受限，学生不校验）
CREATE TABLE IF NOT EXISTS pa_advisor_allow (
    id          SERIAL       PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    allow       BOOLEAN      NOT NULL DEFAULT TRUE,
    create_time TIMESTAMP    NULL DEFAULT NOW(),
    update_time TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_advisor_allow IS '顾问 SSO 登录白名单表（仅顾问受限，学生不校验）';
COMMENT ON COLUMN pa_advisor_allow.id IS 'ID';
COMMENT ON COLUMN pa_advisor_allow.email IS '邮箱地址（匹配 SSO 声明的 email/upn，大小写不敏感）';
COMMENT ON COLUMN pa_advisor_allow.allow IS '允许（FALSE 时等同不在白名单）';
COMMENT ON COLUMN pa_advisor_allow.create_time IS '创建时间';
COMMENT ON COLUMN pa_advisor_allow.update_time IS '更新时间';

-- 咨询时段表
CREATE TABLE IF NOT EXISTS pa_slot (
    id          SERIAL PRIMARY KEY,
    advisor_id  INTEGER      NOT NULL REFERENCES pa_advisor (id),
    start_time  TIMESTAMP    NOT NULL,
    end_time    TIMESTAMP    NOT NULL,
    booked      INTEGER      NOT NULL DEFAULT 0,
    state       VARCHAR(255) NOT NULL DEFAULT '1',
    create_time TIMESTAMP    NULL DEFAULT NOW(),
    update_time TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_slot IS '咨询时段表';
COMMENT ON COLUMN pa_slot.id IS 'ID';
COMMENT ON COLUMN pa_slot.advisor_id IS '顾问ID';
COMMENT ON COLUMN pa_slot.start_time IS '开始时间';
COMMENT ON COLUMN pa_slot.end_time IS '结束时间';
COMMENT ON COLUMN pa_slot.booked IS '已订数';
COMMENT ON COLUMN pa_slot.state IS '状态(1开放/0暂停)';
COMMENT ON COLUMN pa_slot.create_time IS '创建时间';
COMMENT ON COLUMN pa_slot.update_time IS '更新时间';

-- 预约记录表
CREATE TABLE IF NOT EXISTS pa_appointment (
    id              SERIAL PRIMARY KEY,
    apply_no        VARCHAR(255) NOT NULL UNIQUE,
    slot_id         INTEGER      NOT NULL REFERENCES pa_slot (id),
    advisor_id      INTEGER      NOT NULL,
    student_user_id INTEGER      NOT NULL,
    student_name    VARCHAR(255) NOT NULL DEFAULT 'N/A',
    student_no      VARCHAR(255) NOT NULL DEFAULT 'N/A',
    topic           VARCHAR(255) NOT NULL DEFAULT 'N/A',
    content         TEXT         NOT NULL DEFAULT 'N/A',
    mode            VARCHAR(255) NOT NULL DEFAULT 'online',
    phone           VARCHAR(255) NOT NULL DEFAULT 'N/A',
    wechat          VARCHAR(255) NOT NULL DEFAULT '',
    meeting_link    TEXT         NOT NULL DEFAULT '',
    state           VARCHAR(255) NOT NULL DEFAULT 'booked',
    cancel_reason   TEXT         NOT NULL DEFAULT '',
    create_time     TIMESTAMP    NULL DEFAULT NOW(),
    update_time     TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_appointment IS '预约记录表';
COMMENT ON COLUMN pa_appointment.id IS 'ID';
COMMENT ON COLUMN pa_appointment.apply_no IS '预约单号（A+8位数字）';
COMMENT ON COLUMN pa_appointment.slot_id IS '时段ID';
COMMENT ON COLUMN pa_appointment.advisor_id IS '顾问ID';
COMMENT ON COLUMN pa_appointment.student_user_id IS '学生用户ID';
COMMENT ON COLUMN pa_appointment.student_name IS '学生姓名';
COMMENT ON COLUMN pa_appointment.student_no IS '学号';
COMMENT ON COLUMN pa_appointment.topic IS '咨询主题';
COMMENT ON COLUMN pa_appointment.content IS '咨询内容';
COMMENT ON COLUMN pa_appointment.mode IS '咨询方式(online线上/offline线下)';
COMMENT ON COLUMN pa_appointment.phone IS '电话';
COMMENT ON COLUMN pa_appointment.wechat IS '微信号（线上必填/线下选填）';
COMMENT ON COLUMN pa_appointment.meeting_link IS '会议链接（线上选填）';
COMMENT ON COLUMN pa_appointment.state IS '状态(booked已预约/cancelled_student学生取消/cancelled_advisor顾问取消/completed已完成)';
COMMENT ON COLUMN pa_appointment.cancel_reason IS '取消原因（顾问取消时必填）';
COMMENT ON COLUMN pa_appointment.create_time IS '创建时间';
COMMENT ON COLUMN pa_appointment.update_time IS '更新时间';

-- 咨询反馈表
CREATE TABLE IF NOT EXISTS pa_feedback (
    id             SERIAL PRIMARY KEY,
    appointment_id INTEGER      NOT NULL UNIQUE REFERENCES pa_appointment (id),
    advisor_id     INTEGER      NOT NULL,
    summary        TEXT         NOT NULL DEFAULT '',
    handle         TEXT         NOT NULL DEFAULT '',
    need_followup  VARCHAR(255) NOT NULL DEFAULT '0',
    create_time    TIMESTAMP    NULL DEFAULT NOW(),
    update_time    TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_feedback IS '咨询反馈表';
COMMENT ON COLUMN pa_feedback.id IS 'ID';
COMMENT ON COLUMN pa_feedback.appointment_id IS '预约ID';
COMMENT ON COLUMN pa_feedback.advisor_id IS '顾问ID';
COMMENT ON COLUMN pa_feedback.summary IS '咨询总结';
COMMENT ON COLUMN pa_feedback.handle IS '处理方式';
COMMENT ON COLUMN pa_feedback.need_followup IS '是否需要跟进(1是/0否)';
COMMENT ON COLUMN pa_feedback.create_time IS '创建时间';
COMMENT ON COLUMN pa_feedback.update_time IS '更新时间';

-- 邮件发送日志表
CREATE TABLE IF NOT EXISTS pa_email_log (
    id             SERIAL PRIMARY KEY,
    mail_to        VARCHAR(255) NOT NULL DEFAULT '',
    mail_type      VARCHAR(255) NOT NULL DEFAULT '',
    subject        VARCHAR(255) NOT NULL DEFAULT '',
    content        TEXT         NOT NULL DEFAULT '',
    status         VARCHAR(255) NOT NULL DEFAULT 'skipped',
    error          TEXT         NOT NULL DEFAULT '',
    appointment_id INTEGER      NULL,
    create_time    TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_email_log IS '邮件发送日志表';
COMMENT ON COLUMN pa_email_log.id IS 'ID';
COMMENT ON COLUMN pa_email_log.mail_to IS '收件人';
COMMENT ON COLUMN pa_email_log.mail_type IS '邮件类型(booked/cancelled/reminder)';
COMMENT ON COLUMN pa_email_log.subject IS '主题';
COMMENT ON COLUMN pa_email_log.content IS '正文';
COMMENT ON COLUMN pa_email_log.status IS '状态(sent已发送/failed失败/skipped未配置跳过)';
COMMENT ON COLUMN pa_email_log.error IS '错误信息';
COMMENT ON COLUMN pa_email_log.appointment_id IS '关联预约ID';
COMMENT ON COLUMN pa_email_log.create_time IS '创建时间';

-- 邮件模板表（库表驱动：管理员可配置通知文案；缺失时代码内回退默认模板）
CREATE TABLE IF NOT EXISTS pa_mail_template (
    id          SERIAL PRIMARY KEY,
    mail_type   VARCHAR(255) NOT NULL UNIQUE,
    subject     VARCHAR(255) NOT NULL DEFAULT '',
    html        TEXT         NOT NULL DEFAULT '',
    create_time TIMESTAMP    NULL DEFAULT NOW(),
    update_time TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_mail_template IS '邮件模板表';
COMMENT ON COLUMN pa_mail_template.id IS 'ID';
COMMENT ON COLUMN pa_mail_template.mail_type IS '邮件类型(booked/cancelled/reminder)';
COMMENT ON COLUMN pa_mail_template.subject IS '主题模板（支持 {apply_no} 等占位符）';
COMMENT ON COLUMN pa_mail_template.html IS '正文 HTML 模板（支持 {apply_no} 等占位符）';
COMMENT ON COLUMN pa_mail_template.create_time IS '创建时间';
COMMENT ON COLUMN pa_mail_template.update_time IS '更新时间';
-- 默认模板由应用启动时 seed_default_mail_templates 幂等播种（不覆盖已改记录）

-- SSO 单点登录配置表（取 id 最小行生效；预置凭据见 03_sso.sql / 应用 seed_sso_settings）
CREATE TABLE IF NOT EXISTS pa_sso_settings (
    id            SERIAL PRIMARY KEY,
    client_id     VARCHAR(128) NOT NULL,
    client_secret VARCHAR(256) NOT NULL,
    redirect_uri  VARCHAR(256) NOT NULL,
    create_time   TIMESTAMP    NULL DEFAULT NOW(),
    update_time   TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_sso_settings IS 'SSO 单点登录配置表';
COMMENT ON COLUMN pa_sso_settings.id IS 'ID';
COMMENT ON COLUMN pa_sso_settings.client_id IS 'ADFS 分配的 Client ID';
COMMENT ON COLUMN pa_sso_settings.client_secret IS 'ADFS 共享秘钥（明文，仅服务端持有）';
COMMENT ON COLUMN pa_sso_settings.redirect_uri IS 'OAuth2 回调地址（须与 ADFS 注册一致）';
COMMENT ON COLUMN pa_sso_settings.create_time IS '创建时间';
COMMENT ON COLUMN pa_sso_settings.update_time IS '更新时间';

-- SMTP 邮件配置表（取 id 最小行生效；应用启动播种空白行，运维 UPDATE 填写即生效）
CREATE TABLE IF NOT EXISTS pa_smtp_settings (
    id          SERIAL PRIMARY KEY,
    host        VARCHAR(255) NOT NULL DEFAULT '',
    port        INTEGER      NOT NULL DEFAULT 587,
    username    VARCHAR(255) NOT NULL DEFAULT '',
    password    VARCHAR(255) NOT NULL DEFAULT '',
    mail_from   VARCHAR(255) NOT NULL DEFAULT '',
    create_time TIMESTAMP    NULL DEFAULT NOW(),
    update_time TIMESTAMP    NULL DEFAULT NOW()
);
COMMENT ON TABLE pa_smtp_settings IS 'SMTP 邮件配置表';
COMMENT ON COLUMN pa_smtp_settings.id IS 'ID';
COMMENT ON COLUMN pa_smtp_settings.host IS 'SMTP 服务器地址';
COMMENT ON COLUMN pa_smtp_settings.port IS 'SMTP 端口（默认 587 STARTTLS）';
COMMENT ON COLUMN pa_smtp_settings.username IS 'SMTP 登录账号';
COMMENT ON COLUMN pa_smtp_settings.password IS 'SMTP 登录口令（仅服务端持有）';
COMMENT ON COLUMN pa_smtp_settings.mail_from IS '发件人地址（空则取 username）';
COMMENT ON COLUMN pa_smtp_settings.create_time IS '创建时间';
COMMENT ON COLUMN pa_smtp_settings.update_time IS '更新时间';
