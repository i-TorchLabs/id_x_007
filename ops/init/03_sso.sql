-- id_x_007 SSO 单点登录预置配置（CUHK ADFS OAuth2）
-- 应用启动时 seed_sso_settings（x_plugin.build_tables）会幂等写入同样内容，
-- 本文件仅供手动初始化外部库时参考执行，非必需。
--
-- 取代原 .env 的 PA_OAUTH_CLIENT_ID / PA_OAUTH_CLIENT_SECRET / PA_OAUTH_REDIRECT_URI：
-- 服务启动后由 views.load_oauth_config() 读取 pa_sso_settings 中 id 最小的行作为生效配置。
--
-- 回调地址 https://sme-ugo-appointment.cuhk.edu.cn/f/007/user/oauth2 必须在 ADFS
-- 依赖方信任中登记为 redirect_uri（https，区分大小写），且与前端构建期注入的
-- NEXT_PUBLIC_ADFS_REDIRECT_URI 完全一致，否则 ADFS 返回 MSIS9220。
--
-- 幂等：仅在表为空时插入，重复执行不会产生多行配置。

INSERT INTO pa_sso_settings (client_id, client_secret, redirect_uri, create_time, update_time)
SELECT '2e8949a0-7fd4-4c7a-a380-c9e93c103067',
       'jEhpM4HPaUX1OdOgNp5HvvRHnuqClYYoIvSozlKb',
       'https://sme-ugo-appointment.cuhk.edu.cn/f/007/user/oauth2',
       NOW(),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM pa_sso_settings);
