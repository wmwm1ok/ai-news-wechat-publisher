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

【必须遵守】
1) 分类只能从以下四类中选择一个：
- 产品发布与更新
- 技术与研究
- 投融资与并购
- 政策与监管

2) 输出必须是严格 JSON（不要 Markdown，不要代码块，不要解释）：
{
  "title": "新闻标题",
  "summary": "160-260字中文摘要，通顺完整，不包含无信息口水话",
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

请输出 JSON：`;

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    
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

任务：
1) 从以下 articles 数组中筛选并整理 AI 相关新闻（最多筛选 8-10 条，不得编造事实）
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
- summary：160~260 字
- tags：2~4 个

JSON 结构：
{
  "date": "${dateStr}",
  "items": [
    {
      "section": "产品发布与更新",
      "company": "公司名称",
      "title_cn": "中文标题",
      "summary": "中文摘要",
      "source": "来源名称",
      "published_at": "发布时间",
      "tags": ["标签1", "标签2"]
    }
  ]
}

请输出 JSON：`;

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    
    return (parsed.items || []).map(item => ({
      title: item.title_cn || item.title,
      summary: item.summary,
      category: item.section || item.category,
      source: item.source,
      publishedAt: item.published_at || item.publishedAt,
      tags: item.tags || [],
      company: item.company,
      region: '海外'
    }));
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
