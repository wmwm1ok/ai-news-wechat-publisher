import fs from 'fs/promises';
import path from 'path';

/**
 * 为手动发布生成微信图文格式
 * 适用于未认证公众号
 */
export async function generateWechatEditorFormat(groupedNews, outputDir = 'output') {
  const date = new Date().toLocaleDateString('zh-CN');
  const allNews = Object.values(groupedNews).flat();
  
  // 生成标题
  const title = `AI 每日快报｜${date}`;
  
  // 生成封面摘要（取前3条）
  const digest = allNews.slice(0, 3).map(n => n.title).join('；').substring(0, 120);
  
  // 生成微信编辑器格式的 HTML
  const content = generateWechatEditorHTML(groupedNews);
  
  // 保存为文件
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, `wechat-ready-${date.replace(/\//g, '-')}.html`);
  await fs.writeFile(outputPath, content, 'utf-8');
  
  // 同时保存纯文本版本便于复制
  const textPath = path.join(outputDir, `wechat-text-${date.replace(/\//g, '-')}.txt`);
  const textContent = generatePlainText(groupedNews);
  await fs.writeFile(textPath, textContent, 'utf-8');
  
  console.log('\n📋 微信图文已生成（未认证公众号需手动发布）');
  console.log('=====================================');
  console.log(`标题: ${title}`);
  console.log(`摘要: ${digest}`);
  console.log('');
  console.log('文件位置:');
  console.log(`  HTML: ${outputPath}`);
  console.log(`  文本: ${textPath}`);
  console.log('');
  console.log('发布步骤:');
  console.log('  1. 登录 mp.weixin.qq.com');
  console.log('  2. 内容与互动 → 草稿箱 → 新建图文');
  console.log('  3. 复制生成的 HTML 内容到编辑器');
  console.log('  4. 添加封面图片（可选）');
  console.log('  5. 保存并发布');
  console.log('=====================================');
  
  return {
    title,
    digest,
    htmlPath: outputPath,
    textPath
  };
}

function generateWechatEditorHTML(groupedNews) {
  const date = new Date().toLocaleDateString('zh-CN');
  const SECTION_ORDER = [
    '产品发布与更新',
    '技术与研究',
    '投融资与并购',
    '政策与监管'
  ];
  
  const SECTION_ICON = {
    '产品发布与更新': '🚀',
    '技术与研究': '🧠',
    '投融资与并购': '💰',
    '政策与监管': '🏛️'
  };
  
  let html = `
<section style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;line-height:1.8;color:#333;">
  <h1 style="text-align:center;color:#1c5cff;font-size:22px;margin-bottom:10px;">
    AI 每日快报（${date}）
  </h1>
  <p style="text-align:center;color:#999;font-size:13px;margin-bottom:20px;">
    今日精选 AI 行业资讯
  </p>
  
  <blockquote style="background:#f0f7ff;border-left:3px solid #1c5cff;padding:12px 15px;margin:0 0 20px;font-size:13px;color:#666;">
    📌 本期共收录 ${Object.values(groupedNews).flat().length} 条资讯，内容由 AI 自动抓取并生成摘要。
  </blockquote>
`;
  
  for (const section of SECTION_ORDER) {
    const items = groupedNews[section];
    if (!items || items.length === 0) continue;
    
    const icon = SECTION_ICON[section] || '📍';
    
    html += `
  <h2 style="color:#1c5cff;font-size:18px;border-left:4px solid #1c5cff;padding-left:10px;margin:25px 0 15px;">
    ${icon} ${section}
  </h2>
`;
    
    for (const item of items) {
      const meta = [item.source, formatDate(item.publishedAt)]
        .filter(Boolean)
        .join(' · ');
      
      html += `
  <div style="background:#f8f9fa;padding:15px;border-radius:10px;margin-bottom:15px;">
    <h3 style="font-size:16px;color:#333;margin:0 0 8px;line-height:1.5;">
      ${item.company ? `<span style="color:#1c5cff;font-weight:bold;">${escapeHtml(item.company)}</span> · ` : ''}
      ${escapeHtml(item.title)}
    </h3>
    ${meta ? `<p style="font-size:12px;color:#999;margin:0 0 8px;">${escapeHtml(meta)}</p>` : ''}
    <p style="font-size:14px;color:#555;line-height:1.8;margin:0;">
      ${escapeHtml(item.summary)}
    </p>
  </div>
`;
    }
  }
  
  html += `
  <p style="text-align:center;color:#bbb;font-size:12px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;">
    AI 每日快报 · ${date}
  </p>
</section>`;
  
  return html;
}

function generatePlainText(groupedNews) {
  const date = new Date().toLocaleDateString('zh-CN');
  const allNews = Object.values(groupedNews).flat();
  
  let text = `AI 每日快报（${date}）\n`;
  text += `===================\n\n`;
  text += `📌 本期共收录 ${allNews.length} 条资讯\n\n`;
  
  for (const [section, items] of Object.entries(groupedNews)) {
    if (!items || items.length === 0) continue;
    
    text += `【${section}】\n`;
    text += `${'='.repeat(section.length + 2)}\n\n`;
    
    for (const item of items) {
      text += `${item.company ? `[${item.company}] ` : ''}${item.title}\n`;
      text += `来源: ${item.source || '未知'}\n`;
      text += `摘要: ${item.summary}\n\n`;
    }
  }
  
  text += `===================\n`;
  text += `AI 每日快报 · ${date}\n`;
  
  return text;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
