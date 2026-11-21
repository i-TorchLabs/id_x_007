INSERT INTO "pa_mail_template" ("id", "mail_type", "subject", "html", "create_time", "update_time") VALUES
('1', 'booked_student', '预约成功确认｜Appointment Confirmed', '<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>咨询预约确认 / Appointment Confirmation</title>
</head>
<body style="margin:0; padding:24px; font-family:''Times New Roman'', SimSun, serif; font-size:12pt; line-height:1.7; color:#333;">

  <!-- 中文部分 -->
  <div class="section-zh">
    <p><strong>{student_email}</strong>，你好：</p>

    <p>你与朋辈顾问 <strong>{advisor_name}</strong> 于 <strong>{start_time} ~ {end_time}</strong> 的咨询预约已成功确认。</p>

    <p>顾问将通过你提供的联系方式与你联系，确认具体见面地点（线下）或提供线上会议链接。请留意消息。</p>

    <p>如需取消或改期，请至少提前 <strong>4 小时</strong>在系统中操作。</p>

    <p>
      本科生办公室<br>
      经管学院<br>
      电话：0755-235-18590 | 电邮：smeug@cuhk.edu.cn
    </p>

    <p>
      综合教学楼 D 栋 204 室<br>
      香港中文大学（深圳）<br>
      深圳市龙岗区龙翔大道 2001 号
    </p>
  </div>

  <hr style="border:none; border-top:1px solid #ddd; margin:28px 0;">

  <!-- English part -->
  <div class="section-en">
    <p>Dear <strong>{student_email}</strong>,</p>

    <p>Your appointment with Peer Advisor <strong>{advisor_name}</strong> at <strong>{start_time} ~ {end_time}</strong> has been confirmed.</p>

    <p>The advisor will contact you via the contact information you provided to confirm the meeting venue (for in-person) or provide an online meeting link. Please stay tuned.</p>

    <p>To cancel or reschedule, please do so in the system at least <strong>4 hours</strong> in advance.</p>

    <p>
      Undergraduate Studies Office<br>
      School of Management and Economics<br>
      Tel: 0755-235-18590 | Email: smeug@cuhk.edu.cn
    </p>

    <p>
      Room 204, Teaching Complex D<br>
      The Chinese University of Hong Kong, Shenzhen<br>
      2001 Longxiang Boulevard, Longgang District, Shenzhen
    </p>
  </div>

</body>
</html>
', '2026-11-20 23:58:11.768807', '2026-11-21 11:08:16.720375'),
('2', 'booked_advisor', '新预约通知｜New Appointment Booked', '<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>新预约通知 / New Appointment Notification</title>
</head>
<body style="margin:0; padding:24px; font-family:''Times New Roman'', SimSun, serif; font-size:12pt; line-height:1.7; color:#333;">

  <!-- 中文部分 -->
  <div class="section-zh">
    <p><strong>{advisor_name}</strong>，你好：</p>

    <p>你有一个新的咨询预约，请登录系统查看详情，并在 <strong>24 小时</strong>内联系学生确认见面地点（线下）或提供线上链接。</p>

    <p>登录系统：<a href="https://sme-ugo-appointment.cuhk.edu.cn/f/007/admin-login" style="color:#8c1d18; text-decoration:underline;">https://sme-ugo-appointment.cuhk.edu.cn/f/007/admin-login</a></p>

    <p>
      本科生办公室<br>
      经管学院<br>
      电话：0755-235-18590 | 电邮：smeug@cuhk.edu.cn
    </p>

    <p>
      综合教学楼 D 栋 204 室<br>
      香港中文大学（深圳）<br>
      深圳市龙岗区龙翔大道 2001 号
    </p>
  </div>

  <hr style="border:none; border-top:1px solid #ddd; margin:28px 0;">

  <!-- English part -->
  <div class="section-en">
    <p>Dear <strong>{advisor_name}</strong>,</p>

    <p>You have a new appointment. Please log in to view the details and contact the student within <strong>24 hours</strong> to confirm the venue (for in-person) or provide an online link.</p>

    <p>Log in: <a href="https://sme-ugo-appointment.cuhk.edu.cn/f/007/admin-login" style="color:#8c1d18; text-decoration:underline;">https://sme-ugo-appointment.cuhk.edu.cn/f/007/admin-login</a></p>

    <p>
      Undergraduate Studies Office<br>
      School of Management and Economics<br>
      Tel: 0755-235-18590 | Email: smeug@cuhk.edu.cn
    </p>

    <p>
      Room 204, Teaching Complex D<br>
      The Chinese University of Hong Kong, Shenzhen<br>
      2001 Longxiang Boulevard, Longgang District, Shenzhen
    </p>
  </div>

</body>
</html>
', '2026-11-20 23:58:11.773015', '2026-11-21 11:13:53.962062'),
('3', 'reminder', '预约提醒：明日咨询｜Reminder: Appointment Tomorrow', '<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>预约提醒 / Appointment Reminder</title>
</head>
<body style="margin:0; padding:24px; font-family:''Times New Roman'', SimSun, serif; font-size:12pt; line-height:1.7; color:#333;">

  <!-- 中文部分 -->
  <div class="section-zh">
    <p>你好：</p>

    <p>提醒你的咨询预约将于明日 <strong>{start_time} ~ {end_time}</strong> 进行（<strong>30 分钟</strong>）。</p>

    <p>请准时参加。如需取消或改期，请尽快在系统中操作。</p>

    <p>
      本科生办公室<br>
      经管学院<br>
      电话：0755-235-18590 | 电邮：smeug@cuhk.edu.cn
    </p>

    <p>
      综合教学楼 D 栋 204 室<br>
      香港中文大学（深圳）<br>
      深圳市龙岗区龙翔大道 2001 号
    </p>
  </div>

  <hr style="border:none; border-top:1px solid #ddd; margin:28px 0;">

  <!-- English part -->
  <div class="section-en">
    <p>Dear Student,</p>

    <p>Reminder: your consultation appointment is scheduled for tomorrow, <strong>{start_time} ~ {end_time}</strong> (<strong>30 minutes</strong>).</p>

    <p>Please attend on time. If you need to cancel or reschedule, please do so in the system as soon as possible.</p>

    <p>
      Undergraduate Studies Office<br>
      School of Management and Economics<br>
      Tel: 0755-235-18590 | Email: smeug@cuhk.edu.cn
    </p>

    <p>
      Room 204, Teaching Complex D<br>
      The Chinese University of Hong Kong, Shenzhen<br>
      2001 Longxiang Boulevard, Longgang District, Shenzhen
    </p>
  </div>

</body>
</html>
', '2026-11-20 23:58:11.77544', '2026-11-21 11:27:56.832579'),
('4', 'cancelled', '预约已取消｜Appointment Cancelled', '<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>预约取消通知 / Appointment Cancellation Notice</title>
</head>
<body style="margin:0; padding:24px; font-family:''Times New Roman'', SimSun, serif; font-size:12pt; line-height:1.7; color:#333;">

  <!-- 中文部分 -->
  <div class="section-zh">
    <p>你好：</p>

    <p>学生 <strong>{student_email}</strong> 已取消原定于 <strong>{start_time} ~ {end_time}</strong> 与 <strong>{advisor_name}</strong> 的咨询预约。</p>

    <p>该时段已重新开放。如需重新预约，请登录系统操作。</p>

    <p>
      本科生办公室<br>
      经管学院<br>
      电话：0755-235-18590 | 电邮：smeug@cuhk.edu.cn
    </p>

    <p>
      综合教学楼 D 栋 204 室<br>
      香港中文大学（深圳）<br>
      深圳市龙岗区龙翔大道 2001 号
    </p>
  </div>

  <hr style="border:none; border-top:1px solid #ddd; margin:28px 0;">

  <!-- English part -->
  <div class="section-en">
    <p>Dear,</p>

    <p>Student <strong>{student_email}</strong> has cancelled the appointment with <strong>{advisor_name}</strong> originally scheduled on <strong>{start_time} ~ {end_time}</strong>.</p>

    <p>The time slot has been reopened. To book again, please log in to the system.</p>

    <p>
      Undergraduate Studies Office<br>
      School of Management and Economics<br>
      Tel: 0755-235-18590 | Email: smeug@cuhk.edu.cn
    </p>

    <p>
      Room 204, Teaching Complex D<br>
      The Chinese University of Hong Kong, Shenzhen<br>
      2001 Longxiang Boulevard, Longgang District, Shenzhen
    </p>
  </div>

</body>
</html>
', '2026-11-20 23:58:11.777441', '2026-11-21 11:22:41.236227'),
('5', 'cancelled_advisor', '预约取消通知｜Appointment Cancellation Notice', '<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>预约取消通知 / Appointment Cancellation Notice</title>
</head>
<body style="margin:0; padding:24px; font-family:''Times New Roman'', SimSun, serif; font-size:12pt; line-height:1.7; color:#333;">

  <!-- 中文部分 -->
  <div class="section-zh">
    <p><strong>{student_email}</strong> 同学，你好：</p>

    <p>很抱歉，朋辈顾问 <strong>{advisor_name}</strong> 因故取消了原定于 <strong>{start_time} ~ {end_time}</strong> 的咨询预约。</p>

    <p>你可以：</p>
    <ol style="margin:0 0 16px; padding-left:24px;">
      <li>重新预约该顾问的其他时段；</li>
      <li>预约其他朋辈顾问。</li>
    </ol>

    <p>登录系统重新预约：<a href="https://sme-ugo-appointment.cuhk.edu.cn/" style="color:#8c1d18; text-decoration:underline;">https://sme-ugo-appointment.cuhk.edu.cn/</a></p>

    <p>给你带来不便，敬请谅解。</p>

    <p>
      本科生办公室<br>
      经管学院<br>
      电话：0755-235-18590 | 电邮：smeug@cuhk.edu.cn
    </p>

    <p>
      综合教学楼 D 栋 204 室<br>
      香港中文大学（深圳）<br>
      深圳市龙岗区龙翔大道 2001 号
    </p>
  </div>

  <hr style="border:none; border-top:1px solid #ddd; margin:28px 0;">

  <!-- English part -->
  <div class="section-en">
    <p>Dear <strong>{student_email}</strong>,</p>

    <p>We regret to inform you that Peer Advisor <strong>{advisor_name}</strong> has cancelled the appointment originally scheduled on <strong>{start_time} ~ {end_time}</strong>.</p>

    <p>You may:</p>
    <ol style="margin:0 0 16px; padding-left:24px;">
      <li>Book another time slot with the same advisor;</li>
      <li>Book with another peer advisor.</li>
    </ol>

    <p>Log in to reschedule: <a href="https://sme-ugo-appointment.cuhk.edu.cn/" style="color:#8c1d18; text-decoration:underline;">https://sme-ugo-appointment.cuhk.edu.cn/</a></p>

    <p>We apologize for the inconvenience.</p>

    <p>
      Undergraduate Studies Office<br>
      School of Management and Economics<br>
      Tel: 0755-235-18590 | Email: smeug@cuhk.edu.cn
    </p>

    <p>
      Room 204, Teaching Complex D<br>
      The Chinese University of Hong Kong, Shenzhen<br>
      2001 Longxiang Boulevard, Longgang District, Shenzhen
    </p>
  </div>

</body>
</html>
', '2026-11-20 23:58:11.779502', '2026-11-21 11:27:23.12748');
