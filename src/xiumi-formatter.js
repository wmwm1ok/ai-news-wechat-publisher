/**
 * 秀米编辑器格式生成器
 * 生成可以直接复制到秀米编辑器的 HTML
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 生成秀米兼容的 HTML
 */
export async function generateXiumiFormat(groupedNews, outputDir = 'output', docsDir = 'docs') {
  const date = new Date().toLocaleDateString('zh-CN');
  const allNews = Object.values(groupedNews).flat();
  
  // 秀米优化的 HTML（文件版）
  const xiumiHtml = generateXiumiHTML(groupedNews, date, allNews.length);
  
  // 手机预览版（带一键复制）
  const mobileHtml = generateXiumiMobileHTML(groupedNews, date, allNews.length);
  
  // 纯文本（用于备份）
  const plainText = generateXiumiPlainText(groupedNews, date);
  
  // 保存文件
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(docsDir, { recursive: true });
  
  const dateStr = date.replace(/\//g, '-');
  const xiumiPath = path.join(outputDir, `xiumi-${dateStr}.html`);
  const textPath = path.join(outputDir, `xiumi-text-${dateStr}.txt`);
  const mobilePath = path.join(docsDir, 'xiumi.html');
  
  await fs.writeFile(xiumiPath, xiumiHtml, 'utf-8');
  await fs.writeFile(textPath, plainText, 'utf-8');
  await fs.writeFile(mobilePath, mobileHtml, 'utf-8');
  
  console.log('\n📋 秀米格式已生成');
  console.log('====================');
  console.log(`文件位置:`);
  console.log(`  📄 ${xiumiPath} (电脑版)`);
  console.log(`  📱 ${mobilePath} (手机版)`);
  console.log(`  📝 ${textPath} (纯文本)`);
  console.log('');
  console.log('📱 手机使用步骤:');
  console.log('  1. 访问: https://wmwm1ok.github.io/ai-news-wechat-publisher/xiumi.html');
  console.log('  2. 点击「复制秀米格式」');
  console.log('  3. 打开秀米 App/网页，粘贴即可');
  console.log('');
  console.log('💻 电脑使用步骤:');
  console.log('  1. 打开 xiumi-*.html 文件');
  console.log('  2. 全选复制');
  console.log('  3. 粘贴到秀米编辑器');
  console.log('====================');
  
  return {
    xiumiPath,
    textPath,
    mobilePath,
    html: xiumiHtml
  };
}

/**
 * 生成秀米专用 HTML（电脑版）
 */
function generateXiumiHTML(groupedNews, date, totalCount) {
  const SECTION_ORDER = [
    '产品发布与更新',
    '技术与研究',
    '投融资与并购',
    '政策与监管'
  ];
  
  const SECTION_COLORS = {
    '产品发布与更新': '#07c160',
    '技术与研究': '#1989fa',
    '投融资与并购': '#ff6b6b',
    '政策与监管': '#ff9f43'
  };
  
  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>AI日报-秀米格式-${date}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
.header { background: linear-gradient(135deg, #1c5cff, #00c6ff); color: white; padding: 30px; text-align: center; border-radius: 12px; margin-bottom: 20px; }
.header h1 { margin: 0 0 10px; font-size: 24px; }
.header .date { font-size: 14px; opacity: 0.9; }
.tips { background: #fffbe6; border: 1px solid #ffe58f; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #666; }
.tips strong { color: #d48806; }
.section { margin-bottom: 25px; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.section-title { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: 600; margin-bottom: 15px; }
.article { padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px; }
.article h3 { margin: 0 0 8px; font-size: 16px; color: #333; line-height: 1.5; }
.article .meta { font-size: 12px; color: #999; margin-bottom: 8px; }
.article .summary { font-size: 14px; color: #555; line-height: 1.8; margin: 0; }
.footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
.copy-btn { background: #07c160; color: white; border: none; padding: 12px 30px; border-radius: 20px; font-size: 14px; cursor: pointer; position: fixed; bottom: 20px; right: 20px; box-shadow: 0 2px 8px rgba(7,193,96,0.3); }
</style>
</head>
<body>

<div class="header">
  <h1>🤖 AI 每日快报</h1>
  <div class="date">${date} · 精选 ${totalCount} 条 AI 资讯</div>
</div>

<div class="tips">
  <strong>💡 使用说明：</strong>点击右下角「复制全部」按钮，或按 Ctrl+A 全选复制，然后粘贴到秀米编辑器
</div>

<div id="content">
`;

  // 遍历分类
  for (const section of SECTION_ORDER) {
    const items = groupedNews[section];
    if (!items || items.length === 0) continue;
    
    const color = SECTION_COLORS[section] || '#1c5cff';
    
    html += `
<div class="section">
  <div class="section-title" style="background: ${color};">${section}</div>
`;
    
    for (const item of items) {
      const meta = [item.source, formatDate(item.publishedAt)]
        .filter(Boolean)
        .join(' · ');
      
      html += `
  <div class="article">
    <h3>${item.company ? `<span style="color: ${color};">[${escapeHtml(item.company)}]</span> ` : ''}${escapeHtml(item.title)}</h3>
    ${meta ? `<div class="meta">📰 ${escapeHtml(meta)}</div>` : ''}
    <div class="summary">${escapeHtml(item.summary)}</div>
  </div>
`;
    }
    
    html += `</div>

`;
  }

  html += `</div>

<div class="footer">
  AI 每日快报 · ${date}<br>
  <span style="color: #bbb;">内容由 AI 自动生成</span>
</div>

<button class="copy-btn" onclick="copyContent()">📋 复制全部</button>

<script>
function copyContent() {
  const content = document.getElementById('content');
  const range = document.createRange();
  range.selectNode(content);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  document.execCommand('copy');
  window.getSelection().removeAllRanges();
  alert('✅ 已复制全部内容！请粘贴到秀米编辑器');
}
</script>

</body>
</html>`;

  return html;
}

/**
 * 生成秀米手机版（带一键复制）
 */
function generateXiumiMobileHTML(groupedNews, date, totalCount) {
  const SECTION_ORDER = [
    '产品发布与更新',
    '技术与研究',
    '投融资与并购',
    '政策与监管'
  ];
  
  const SECTION_COLORS = {
    '产品发布与更新': '#07c160',
    '技术与研究': '#1989fa',
    '投融资与并购': '#ff6b6b',
    '政策与监管': '#ff9f43'
  };
  
  let articlesHtml = '';
  
  for (const section of SECTION_ORDER) {
    const items = groupedNews[section];
    if (!items || items.length === 0) continue;
    
    const color = SECTION_COLORS[section] || '#1c5cff';
    
    articlesHtml += `
      <div class="section-title" style="background:${color};">${section}</div>
    `;
    
    for (const item of items) {
      const meta = [item.source, formatDate(item.publishedAt)]
        .filter(Boolean)
        .join(' · ');
      
      articlesHtml += `
      <div class="article">
        <div class="title">${item.company ? `<span style="color:${color};">[${item.company}]</span> ` : ''}${escapeHtml(item.title)}</div>
        ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
        <div class="summary">${escapeHtml(item.summary)}</div>
      </div>
      `;
    }
  }
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>AI日报-秀米格式-${date}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; background: #f5f5f5; padding-bottom: 100px; }
.header { background: linear-gradient(135deg, #1c5cff, #00c6ff); color: white; padding: 30px 20px; text-align: center; }
.header h1 { font-size: 22px; margin-bottom: 8px; }
.header .date { font-size: 13px; opacity: 0.9; }
.guide { background: #fffbe6; border: 1px solid #ffe58f; padding: 12px 15px; margin: 15px; border-radius: 8px; font-size: 12px; color: #666; }
.guide strong { color: #d48806; }
.content { padding: 15px; }
.section-title { display: inline-block; padding: 6px 14px; border-radius: 15px; color: white; font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.article { background: white; padding: 15px; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.article .title { font-size: 15px; font-weight: 600; color: #333; line-height: 1.5; margin-bottom: 6px; }
.article .meta { font-size: 11px; color: #999; margin-bottom: 8px; }
.article .summary { font-size: 13px; color: #555; line-height: 1.7; }
.float-btn { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #ff69b4; color: white; border: none; padding: 14px 35px; border-radius: 25px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 15px rgba(255,105,180,0.4); z-index: 100; -webkit-tap-highlight-color: transparent; }
.float-btn:active { transform: translateX(-50%) scale(0.96); }
.toast { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.85); color: white; padding: 16px 28px; border-radius: 8px; font-size: 14px; display: none; z-index: 200; }
</style>
</head>
<body>

<div class="header">
  <h1>🤖 AI 每日快报</h1>
  <div class="date">${date} · ${totalCount} 条资讯</div>
</div>

<div class="guide">
  <strong>💡 秀米发布步骤：</strong><br>
  1. 点击下方「复制秀米格式」<br>
  2. 打开秀米 App 或 xiumi.us<br>
  3. 粘贴到编辑区即可
</div>

<div class="content" id="content">
${articlesHtml}
</div>

<button class="float-btn" onclick="copyXiumi()">📝 复制秀米格式</button>
<div class="toast" id="toast"></div>

<script>
function copyXiumi() {
  const text = document.getElementById('content').innerHTML;
  const fullHtml = '<section style="max-width:600px;margin:0 auto;padding:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">' + text + '</section>';
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(fullHtml).then(() => showToast('✅ 已复制秀米格式！'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = fullHtml;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ 已复制秀米格式！');
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2000);
}
</script>

</body>
</html>`;
}

/**
 * 生成秀米纯文本格式（备用）
 */
function generateXiumiPlainText(groupedNews, date) {
  const allNews = Object.values(groupedNews).flat();
  
  let text = `【AI每日快报】${date}\n`;
  text += `${'='.repeat(30)}\n\n`;
  
  for (const [section, items] of Object.entries(groupedNews)) {
    if (!items || items.length === 0) continue;
    
    text += `【${section}】\n`;
    text += `${'-'.repeat(20)}\n\n`;
    
    for (const item of items) {
      text += `${item.company ? `[${item.company}] ` : ''}${item.title}\n`;
      text += `来源：${item.source || '未知'}\n`;
      text += `摘要：${item.summary}\n\n`;
    }
  }
  
  text += `${'='.repeat(30)}\n`;
  text += `AI每日快报 · ${date}\n`;
  
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
