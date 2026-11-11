-- id_x_007 预置数据（手动初始化外部库时跟随 01_init.sql 执行，非必需）
--
-- 预置管理员：直接植入 pa_user（幂等，用户名冲突时跳过）：
--   username / email : sme@cuhk.edu.cn
--   password         : P@sssme!（PBKDF2-HMAC-SHA256，10 万次迭代，格式 pbkdf2$<盐>$<摘要>，
--                      与后端 utils/x_security.py 一致；盐为固定值，改口令后由后端随机盐重哈希）
--   role / name      : admin / Admin
--   state / is_active: 1 / TRUE（直接可登录，无需运维激活）
--
-- 应用侧 seed_initial_admin（x_plugin.build_tables）仍作兜底：目标用户名已存在则跳过，
-- 不会与本文件冲突；如需更换预置账号，改 ADMIN_USERNAME / ADMIN_PASSWORD 并更新下方哈希。
--
-- 请登录管理后台「顾问管理」创建（仅建 pa_advisor 档案，不落 pa_user，经 CUHK SSO 登录后按账号匹配）；
-- 学生账号由首次 SSO 登录自动建档，无需预置。

INSERT INTO pa_user (username, password, "key", role, name, email, state, is_active, create_time, update_time)
VALUES (
    'sme@cuhk.edu.cn',
    'pbkdf2$007a6c5b9e13d2f4a1b8c3e6f09d4a7b$943c8c3fa1b85b251b5f7ce20154a65fa21f44438a85b4e6b7992b0b744f2647',
    'N/A',
    'admin',
    'Admin',
    'sme@cuhk.edu.cn',
    '1',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (username) DO NOTHING;
