import axios from 'axios';
import { CONFIG, SECTION_ORDER } from './config.js';

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(prompt) {
  try {
    const response = await axios.post(
      CONFIG.deepseek.apiUrl,
      {
        model: CONFIG.deepseek.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的 AI 行业新闻编辑，擅长总结新闻并分类。输出必须是严格的 JSON 格式。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    const content = response.data.choices[0]?.message?.content || '';
    
    // 清理可能的 Markdown 代码块
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    return cleaned;
  } catch (error) {
    console.error('DeepSeek API 调用失败:', error.message);
    if (error.response) {
      console.error('响应:', error.response.data);
    }
    throw error;
  }
}

/**
 * 单条新闻总结和分类
 */
async function summarizeSingle(item) {
  const prompt = `你是一名AI行业新闻编辑。请基于提供的新闻信息进行总结和分类。

【绝对禁止】
- 禁止编造任何新闻事实
- 禁止将旧闻改写成"今日发布"
- 必须严格基于输入的新闻内容总结

【必须遵守】
1) 分类只能从以下四类中选择一个：
- 产品发布与更新
- 技术与研究
- 投融资与并购
- 政策与监管

2) 输出必须是严格 JSON（不要 Markdown，不要代码块，不要解释）：
{
  "title": "新闻标题（基于原标题，可适当优化但不得改变原意）",
  "summary": "160-260字中文摘要，基于输入的摘要内容总结，不得编造",
  "category": "分类名称",
  "source": "来源",
  "publishedAt": "发布时间",
  "tags": ["标签1", "标签2"]
}

【输入数据】
标题：${item.title}
来源：${item.source}
时间：${item.publishedAt}
摘要：${item.snippet}

请基于以上输入数据输出 JSON：`;

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    
    // 验证标题是否与原始标题相关（防止 AI 编造完全不同的新闻）
    const originalTitle = item.title.toLowerCase();
    const returnedTitle = (parsed.title || '').toLowerCase();
    
    // 检查标题相似度（简单检查：是否有共同的关键词）
    const hasSimilarity = returnedTitle.includes(originalTitle.substring(0, 15)) ||
                         originalTitle.includes(returnedTitle.substring(0, 15));
    
    if (!hasSimilarity && originalTitle.length > 10) {
      console.warn(`⚠️ 国内新闻标题不匹配，可能为编造:`);
      console.warn(`   原始: ${item.title.substring(0, 50)}...`);
      console.warn(`   返回: ${parsed.title?.substring(0, 50)}...`);
      // 使用原始标题作为备选
      parsed.title = item.title;
    }
    
    return {
      ...parsed,
      url: item.url,
      region: item.region
    };
  } catch (error) {
    console.error(`总结失败: ${item.title}`, error.message);
    return null;
  }
}

/**
 * 批量总结海外新闻（使用聚合模式）
 */
async function summarizeOverseasBatch(items) {
  if (items.length === 0) return [];
  
  const dateStr = new Date().toLocaleDateString('zh-CN');
  const articlesJson = JSON.stringify(items.map(item => ({
    title: item.title,
    snippet: item.snippet,
    source: item.source,
    publishedAt: item.publishedAt
  })));

  const prompt = `你是 AI 行业日报编辑，内容将发布到微信公众号。读者位于中国大陆。

【绝对禁止 - 违反会导致严重后果】
- 严禁编造任何新闻内容、公司名、产品名或发布时间
- 严禁将历史旧闻改写成"今日发布"或"刚刚发布"
- 严禁根据常识"补充"输入数据中没有的信息
- 只能基于提供的 articles 数组中的内容进行总结

任务：
1) 从以下 articles 数组中筛选并整理 AI 相关新闻（最多筛选 8-10 条）
2) 按以下 4 个模块分类（固定，不得新增/改名）：
   - 产品发布与更新
   - 技术与研究
   - 投融资与并购
   - 政策与监管
3) 去重规则：相同/高度相似事件只保留 1 条
4) "政策与监管"最多保留 2 条

【输入数据】
${articlesJson}

【输出要求】
- 必须是严格 JSON（不要 Markdown，不要 \`\`\`，不要解释性文字）
- 简体中文；可保留常见英文术语
- 禁止在任何字段输出 URL
- title_cn：必须基于原标题翻译/优化，不得编造新的标题
- summary：160~260 字，必须基于输入的新闻内容总结，不得编造
- tags：2~4 个
- 保持原始发布时间（published_at），不得修改

JSON 结构：
{
  "date": "${dateStr}",
  "items": [
    {
      "section": "产品发布与更新",
      "company": "公司名称（输入数据中有就写，没有就不写）",
      "title_cn": "中文标题（基于原标题翻译）",
      "summary": "中文摘要（基于输入内容总结）",
      "source": "来源名称",
      "published_at": "发布时间（保持原始时间）",
      "tags": ["标签1", "标签2"]
    }
  ]
}

请基于输入数据严格输出 JSON，严禁编造：`;

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    
    // 验证并保留原始 URL
    const validated = [];
    const originalTitles = new Set(items.map(i => i.title.toLowerCase()));
    
    for (const item of parsed.items || []) {
      const title = item.title_cn || item.title;
      // 检查标题是否与原始数据有较高相似度
      const titleLower = title.toLowerCase();
      let matched = false;
      let originalItem = null;
      
      for (const orig of items) {
        const origTitleLower = orig.title.toLowerCase();
        // 简单相似度检查：包含关系或编辑距离
        if (titleLower.includes(origTitleLower.substring(0, 20)) || 
            origTitleLower.includes(titleLower.substring(0, 20))) {
          matched = true;
          originalItem = orig;
          break;
        }
      }
      
      if (!matched) {
        console.warn(`⚠️ 海外新闻标题不匹配，可能为编造: "${title.substring(0, 40)}..."`);
        continue;
      }
      
      validated.push({
        title: title,
        summary: item.summary,
        category: item.section || item.category,
        source: item.source,
        publishedAt: item.published_at || item.publishedAt,
        tags: item.tags || [],
        company: item.company,
        region: '海外',
        url: originalItem?.url || ''
      });
    }
    
    console.log(`   验证通过 ${validated.length}/${parsed.items?.length || 0} 条海外新闻`);
    return validated;
  } catch (error) {
    console.error('海外新闻批量总结失败:', error.message);
    return [];
  }
}

/**
 * 总结所有新闻
 */
export async function summarizeNews({ domestic, overseas }) {
  console.log('\n🤖 开始 AI 总结...\n');
  
  // 国内新闻：逐条总结
  console.log(`正在总结 ${domestic.length} 条国内新闻...`);
  const domesticSummaries = [];
  for (const item of domestic.slice(0, 8)) {
    const summary = await summarizeSingle(item);
    if (summary) {
      domesticSummaries.push(summary);
    }
    // 添加延迟避免 rate limit
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 海外新闻：批量总结
  console.log(`正在总结 ${overseas.length} 条海外新闻...`);
  const overseasSummaries = await summarizeOverseasBatch(overseas);
  
  console.log(`\n✅ 总结完成:`);
  console.log(`   国内: ${domesticSummaries.length} 条`);
  console.log(`   海外: ${overseasSummaries.length} 条\n`);
  
  // 合并并按分类分组
  const allNews = [...domesticSummaries, ...overseasSummaries];
  
  // 按分类分组
  const grouped = {};
  SECTION_ORDER.forEach(section => {
    grouped[section] = allNews.filter(item => item.category === section);
  });
  
  // 添加"其他"分类
  const otherNews = allNews.filter(item => !SECTION_ORDER.includes(item.category));
  if (otherNews.length > 0) {
    grouped['其他'] = otherNews;
  }
  
  return grouped;
}
