import { SECTION_ORDER, SECTION_ICON } from './config.js';

/**
 * HTML 转义
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 格式化日期（统一格式：M月D日）
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  try {
    // 处理各种日期格式
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // 尝试提取日期部分（如 "Sat, 14 Feb 2026..."）
      const match = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (match) {
        const m = parseInt(match[2]);
        const d = parseInt(match[3]);
        return `${m}月${d}日`;
      }
      return '';
    }
    
    const m = date.getMonth() + 1;
    const day = date.getDate();
    return `${m}月${day}日`;
  } catch (e) {
    return '';
  }
}

/**
 * 渲染单条新闻卡片
 */
function renderNewsCard(item, index) {
  const meta = [item.source, formatDate(item.publishedAt)]
    .filter(Boolean)
    .join(' · ');
  
  const tagsHtml = Array.isArray(item.tags) && item.tags.length > 0
    ? `<div style="margin-top:10px;">
        ${item.tags.map(tag => `
          <span style="display:inline-block;background:#eef4ff;border:1px solid #dbe7ff;border-radius:999px;padding:3px 10px;margin:4px 6px 0 0;font-size:12px;color:#1c5cff;">
            ${escapeHtml(tag)}
          </span>
        `).join('')}
      </div>`
    : '';
  
  const companyHtml = item.company
    ? `<span style="color:#1c5cff;font-weight:700;">${escapeHtml(item.company)}</span> · `
    : '';

  return `
    <div style="padding:14px 14px;border-radius:14px;background:#fff;box-shadow:0 1px 0 rgba(0,0,0,0.06);margin-bottom:12px;">
      <div style="font-size:15.5px;font-weight:900;margin-bottom:6px;color:#111;">
        ${index + 1}. ${companyHtml}${escapeHtml(item.title)}
      </div>
      ${meta ? `<div style="font-size:12px;color:#888;margin-bottom:10px;">${escapeHtml(meta)}</div>` : ''}
      <div style="font-size:14px;color:#333;line-height:1.75;">
        ${escapeHtml(item.summary)}
      </div>
      ${tagsHtml}
    </div>
  `;
}

/**
 * 渲染分类区块
 */
function renderSection(sectionName, items) {
  if (!items || items.length === 0) return '';
  
  const icon = SECTION_ICON[sectionName] || '📍';
  
  return `
    <div style="background:#f2f2f2;border-radius:16px;padding:18px;margin:18px 0;">
      <div style="font-size:18px;font-weight:900;color:#1c5cff;margin-bottom:14px;">
        ${icon} ${escapeHtml(sectionName)} 
        <span style="color:#666;font-weight:700;">（${items.length}）</span>
      </div>
      ${items.map((item, idx) => renderNewsCard(item, idx)).join('')}
    </div>
  `;
}

/**
 * 渲染整个内容区域
 */
function renderContent(groupedNews) {
  let html = '';
  
  // 按固定顺序渲染分类
  for (const section of SECTION_ORDER) {
    html += renderSection(section, groupedNews[section]);
  }
  
  // 渲染其他分类
  for (const [section, items] of Object.entries(groupedNews)) {
    if (SECTION_ORDER.includes(section)) continue;
    html += renderSection(section, items);
  }
  
  return html;
}

/**
 * 生成完整 HTML
 */
export function generateHTML(groupedNews, options = {}) {
  const date = formatDate(new Date());
  const title = options.title || `AI 每日快报（${date}）`;
  const subtitle = options.subtitle || '今日精选 AI 资讯';
  
  const content = renderContent(groupedNews);
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;">
  <div style="max-width:760px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',Roboto,Arial;line-height:1.75;color:#111;padding:20px;background:#fff;">
    
    <!-- 标题区 -->
    <div style="text-align:center;padding:20px 0;border-bottom:2px solid #1c5cff;margin-bottom:20px;">
      <div style="font-size:28px;font-weight:900;margin-bottom:8px;color:#1c5cff;">${escapeHtml(title)}</div>
      <div style="color:#666;font-size:14px;">${escapeHtml(subtitle)}</div>
    </div>
    
    <!-- 导读 -->
    <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin-bottom:20px;border-left:4px solid #1c5cff;">
      <div style="font-size:14px;color:#555;line-height:1.8;">
        📌 本期涵盖${SECTION_ORDER.filter(s => groupedNews[s]?.length > 0).map(s => SECTION_ICON[s] + s).join('、')}等领域。
      </div>
    </div>
    
    <!-- 内容区 -->
    ${content}
    
    <!-- 底部 -->
    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;">
      <div>AI 每日快报 · 每日 8:00 自动更新</div>
      <div style="margin-top:8px;">${date}</div>
    </div>
    
  </div>
</body>
</html>`;

  return html;
}

/**
 * 生成微信公众号专用 HTML
 * （微信公众号有一些特殊的 HTML 限制）
 */
export function generateWechatHTML(groupedNews, options = {}) {
  const date = formatDate(new Date());
  const title = options.title || `AI 每日快报（${date}）`;
  
  let content = '';
  
  for (const section of SECTION_ORDER) {
    const items = groupedNews[section];
    if (!items || items.length === 0) continue;
    
    const icon = SECTION_ICON[section] || '📍';
    
    content += `
      <h2 style="color:#1c5cff;font-size:18px;border-left:4px solid #1c5cff;padding-left:10px;margin:20px 0 15px;">
        ${icon} ${section}
      </h2>
    `;
    
    for (const item of items) {
      const meta = [item.source, formatDate(item.publishedAt)]
        .filter(Boolean)
        .join(' · ');
      
      const tagsHtml = Array.isArray(item.tags) && item.tags.length > 0
        ? `<p style="margin-top:8px;">${item.tags.map(tag => 
            `<span style="background:#eef4ff;color:#1c5cff;padding:2px 8px;border-radius:10px;font-size:12px;margin-right:5px;">${escapeHtml(tag)}</span>`
          ).join('')}</p>`
        : '';
      
      content += `
        <div style="background:#f8f9fa;padding:15px;border-radius:10px;margin-bottom:15px;">
          <h3 style="font-size:16px;color:#333;margin:0 0 10px;line-height:1.5;">
            ${item.company ? `<strong style="color:#1c5cff;">${escapeHtml(item.company)}</strong> · ` : ''}
            ${escapeHtml(item.title)}
          </h3>
          ${meta ? `<p style="font-size:12px;color:#999;margin:0 0 10px;">${escapeHtml(meta)}</p>` : ''}
          <p style="font-size:14px;color:#555;line-height:1.8;margin:0;">
            ${escapeHtml(item.summary)}
          </p>
          ${tagsHtml}
        </div>
      `;
    }
  }
  
  return `<section style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;line-height:1.75;color:#333;">
    <h1 style="text-align:center;color:#1c5cff;font-size:22px;margin-bottom:10px;">${escapeHtml(title)}</h1>
    <p style="text-align:center;color:#999;font-size:13px;margin-bottom:20px;">今日精选 AI 行业资讯</p>
    
    <blockquote style="background:#f0f7ff;border-left:3px solid #1c5cff;padding:12px 15px;margin:0 0 20px;font-size:13px;color:#666;">
      📌 本期精选 AI 行业资讯。
    </blockquote>
    
    ${content}
    
    <p style="text-align:center;color:#bbb;font-size:12px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;">
      AI 每日快报 · ${date}
    </p>
  </section>`;
}
