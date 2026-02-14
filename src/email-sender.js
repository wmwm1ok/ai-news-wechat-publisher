/**
 * 邮件发送模块
 * 将生成的 HTML 文件发送到指定邮箱
 */

import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

/**
 * 发送邮件（带附件）
 */
export async function sendEmailWithAttachments({
  to,
  subject,
  html,
  attachments = [],
  text = ''
}) {
  // 从环境变量读取 SMTP 配置
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  if (!smtpUser || !smtpPass) {
    console.log('⚠️  未配置 SMTP，跳过邮件发送');
    console.log('   如需邮件功能，请配置 SMTP_USER 和 SMTP_PASS');
    return null;
  }
  
  console.log('📧 正在发送邮件...');
  console.log(`   收件人: ${to}`);
  console.log(`   主题: ${subject}`);
  console.log(`   附件数: ${attachments.length}`);
  
  try {
    // 创建邮件传输器
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    
    // 准备附件
    const emailAttachments = await Promise.all(
      attachments.map(async (filePath) => {
        const filename = path.basename(filePath);
        const content = await fs.readFile(filePath);
        return {
          filename,
          content,
          contentType: 'text/html'
        };
      })
    );
    
    // 发送邮件
    const info = await transporter.sendMail({
      from: `"AI日报" <${smtpUser}>`,
      to,
      subject,
      text: text || '请查收附件中的 AI 日报 HTML 文件',
      html: html || '<p>请查收附件中的 AI 日报 HTML 文件，直接在手机上打开即可复制到秀米编辑器。</p>',
      attachments: emailAttachments
    });
    
    console.log('✅ 邮件发送成功！');
    console.log(`   消息 ID: ${info.messageId}`);
    
    return info;
  } catch (error) {
    console.error('❌ 邮件发送失败:', error.message);
    throw error;
  }
}

/**
 * 发送日报邮件（简化版）
 */
export async function sendDailyNewsEmail({
  to = 'wmwm1ok@gmail.com',
  date,
  xiumiHtmlPath,
  wechatHtmlPath,
  plainTextPath,
  articleCount
}) {
  const subject = `🤖 AI每日快报｜${date}（${articleCount}条资讯）`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #1c5cff, #00c6ff); color: white; padding: 30px; text-align: center; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 10px; font-size: 24px; }
    .content { background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; }
    .file-list { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .file-item { padding: 8px 0; border-bottom: 1px solid #eee; }
    .file-item:last-child { border-bottom: none; }
    .btn { display: inline-block; background: #07c160; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .tips { background: #fffbe6; border-left: 4px solid #ffd700; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 AI 每日快报</h1>
    <p>${date} · 共 ${articleCount} 条精选资讯</p>
  </div>
  
  <div class="content">
    <h2>📎 附件说明</h2>
    <p>本次日报已生成以下格式的文件，请查收附件：</p>
    
    <div class="file-list">
      <div class="file-item">
        <strong>📱 秀米格式（推荐）</strong><br>
        <small>文件名：xiumi-${date}.html</small><br>
        <small>使用方法：手机打开 → 一键复制 → 粘贴到秀米</small>
      </div>
      <div class="file-item">
        <strong>💬 微信公众号格式</strong><br>
        <small>文件名：wechat-ready-${date}.html</small><br>
        <small>使用方法：复制内容到公众号编辑器</small>
      </div>
      <div class="file-item">
        <strong>📝 纯文本版本</strong><br>
        <small>文件名：wechat-text-${date}.txt</small><br>
        <small>备用格式，适合纯文本编辑</small>
      </div>
    </div>
    
    <div class="tips">
      <strong>💡 快速发布步骤：</strong><br>
      1. 在手机上打开附件中的 xiumi-*.html 文件<br>
      2. 点击「复制秀米格式」按钮<br>
      3. 打开秀米 App 或网页版<br>
      4. 粘贴到编辑区，微调后发布
    </div>
    
    <p style="color: #666; font-size: 14px;">
      此邮件由 AI 日报系统自动发送<br>
      每天 8:00 自动抓取最新 AI 资讯
    </p>
  </div>
  
  <div class="footer">
    AI 每日快报 · 自动推送系统
  </div>
</body>
</html>`;
  
  const text = `AI每日快报｜${date}

共 ${articleCount} 条精选资讯

附件说明：
1. xiumi-${date}.html - 秀米格式（推荐手机打开一键复制）
2. wechat-ready-${date}.html - 微信公众号格式
3. wechat-text-${date}.txt - 纯文本版本

使用步骤：
1. 在手机上打开秀米格式 HTML 文件
2. 点击「复制秀米格式」按钮
3. 打开秀米 App 粘贴发布

此邮件由 AI 日报系统自动发送`;
  
  // 收集所有附件路径
  const attachments = [];
  if (xiumiHtmlPath) attachments.push(xiumiHtmlPath);
  if (wechatHtmlPath) attachments.push(wechatHtmlPath);
  if (plainTextPath) attachments.push(plainTextPath);
  
  return await sendEmailWithAttachments({
    to,
    subject,
    html,
    text,
    attachments
  });
}
