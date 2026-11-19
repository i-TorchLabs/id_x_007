-- id_x_007 SMTP 邮件预置配置（CUHK 邮件服务器）
-- 应用启动时 seed_smtp_settings（x_plugin.build_tables）会幂等写入同样内容，
-- 本文件仅供手动初始化外部库时参考执行，非必需。
--
-- 取代原 .env 的 PA_SMTP_HOST / PA_SMTP_PORT / PA_SMTP_USER /
-- PA_SMTP_PASSWORD / PA_MAIL_FROM：服务运行期由 x_mail._smtp_config()
-- 读取 pa_smtp_settings 中 id 最小的行作为生效配置，改表即生效、无需重启。
--
-- 幂等：仅在表为空时插入，重复执行不会产生多行配置。

INSERT INTO pa_smtp_settings (host, port, username, password, mail_from, create_time, update_time)
SELECT 'mail.cuhk.edu.cn',
       587,
       'smeug@cuhk.edu.cn',
       'P@cuhksz2026!',
       'smeug@cuhk.edu.cn',
       NOW(),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM pa_smtp_settings);
