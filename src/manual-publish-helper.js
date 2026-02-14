import fs from 'fs/promises';
import path from 'path';

/**
 * 为手动发布生成微信图文格式
 * 适用于未认证公众号
 */
export async function generateWechatEditorFormat(groupedNews, outputDir = 'output', mobileDir = 'docs') {
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
  await fs.mkdir(mobileDir, { recursive: true });
  
  const outputPath = path.join(outputDir, `wechat-ready-${date.replace(/\//g, '-')}.html`);
  await fs.writeFile(outputPath, content, 'utf-8');
  
  // 同时保存纯文本版本便于复制
  const textPath = path.join(outputDir, `wechat-text-${date.replace(/\//g, '-')}.txt`);
  const textContent = generatePlainText(groupedNews);
  await fs.writeFile(textPath, textContent, 'utf-8');
  
  // 生成手机版预览页面
  const mobileHtml = generateMobileHTML(groupedNews, date, allNews.length);
  const mobilePath = path.join(mobileDir, 'index.html');
  await fs.writeFile(mobilePath, mobileHtml, 'utf-8');
  
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

/**
 * 生成手机版 HTML（带一键复制功能）
 */
function generateMobileHTML(groupedNews, date, totalCount) {
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
  
  let articlesHtml = '';
  
  for (const section of SECTION_ORDER) {
    const items = groupedNews[section];
    if (!items || items.length === 0) continue;
    
    const icon = SECTION_ICON[section] || '📍';
    
    articlesHtml += `
      <h2>${icon} ${section}</h2>
    `;
    
    for (const item of items) {
      const meta = [item.source, formatDate(item.publishedAt)]
        .filter(Boolean)
        .join(' · ');
      
      articlesHtml += `
        <div class="article">
          <div class="title">${item.company ? `[${item.company}] ` : ''}${escapeHtml(item.title)}</div>
          ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
          <div class="summary">${escapeHtml(item.summary)}</div>
        </div>
      `;
    }
  }
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI日报 - ${date}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
        background: #f5f5f5;
        padding-bottom: 80px;
      }
      .header {
        background: linear-gradient(135deg, #1c5cff 0%, #00c6ff 100%);
        color: white;
        padding: 30px 20px;
        text-align: center;
      }
      .header h1 { font-size: 24px; margin-bottom: 8px; }
      .header .date { font-size: 14px; opacity: 0.9; }
      .content { padding: 15px; }
      h2 {
        color: #1c5cff;
        font-size: 16px;
        margin: 20px 0 12px;
        padding: 8px 12px;
        background: #eef4ff;
        border-radius: 6px;
      }
      .article {
        background: white;
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .article .title {
        font-size: 15px;
        font-weight: 600;
        color: #333;
        line-height: 1.5;
        margin-bottom: 6px;
      }
      .article .meta {
        font-size: 11px;
        color: #999;
        margin-bottom: 8px;
      }
      .article .summary {
        font-size: 13px;
        color: #666;
        line-height: 1.7;
      }
      .float-btn {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #07c160;
        color: white;
        border: none;
        padding: 14px 32px;
        border-radius: 25px;
        font-size: 15px;
        font-weight: 600;
        box-shadow: 0 4px 15px rgba(7, 193, 96, 0.4);
        z-index: 100;
        -webkit-tap-highlight-color: transparent;
      }
      .float-btn:active {
        transform: translateX(-50%) scale(0.96);
      }
      .toast {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 16px 28px;
        border-radius: 8px;
        font-size: 14px;
        display: none;
        z-index: 200;
      }
      .guide {
        background: #fffbe6;
        border: 1px solid #ffe58f;
        padding: 12px 15px;
        margin: 15px;
        border-radius: 8px;
        font-size: 12px;
        color: #666;
      }
      .guide strong { color: #d48806; }
    </style>
</head>
<body>
    <div class="header">
      <h1>🤖 AI 每日快报</h1>
      <div class="date">${date} · 共 ${totalCount} 条资讯</div>
    </div>
    
    <div class="guide">
      <strong>📱 快速发布：</strong><br>
      1. 点击底部「一键复制」<br>
      2. 打开「公众号助手」App<br>
      3. 粘贴并发布
    </div>
    
    <div class="content" id="content">
      ${articlesHtml}
    </div>
    
    <button class="float-btn" onclick="copyAll()">📋 一键复制</button>
    <div class="toast" id="toast"></div>
    
    <script>
      function copyAll() {
        const text = document.getElementById('content').innerText;
        const fullText = 'AI 每日快报｜${date}\\n\\n' + text;
        
        if (navigator.clipboard) {
          navigator.clipboard.writeText(fullText).then(() => showToast('✅ 已复制！'));
        } else {
          const ta = document.createElement('textarea');
          ta.value = fullText;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast('✅ 已复制！');
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
