import axios from 'axios';
import { CONFIG } from './config.js';

async function callDeepSeek(prompt) {
  try {
    const response = await axios.post(
      CONFIG.deepseek.apiUrl,
      {
        model: CONFIG.deepseek.model,
        messages: [
          { role: 'system', content: '你是AI新闻编辑，输出严格JSON。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000  // 增加token确保摘要完整
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
    return content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } catch (error) {
    console.error('DeepSeek API 调用失败:', error.message);
    throw error;
  }
}

function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('发布') || t.includes('上线') || t.includes('推出') || t.includes('更新') || t.includes('launch') || t.includes('release')) {
    return '产品发布与更新';
  }
  if (t.includes('融资') || t.includes('投资') || t.includes('并购') || t.includes('收购') || t.includes('fund') || t.includes('invest')) {
    return '投融资与并购';
  }
  if (t.includes('政策') || t.includes('监管') || t.includes('法规') || t.includes('版权') || t.includes('policy') || t.includes('regulation')) {
    return '政策与监管';
  }
  return '技术与研究';
}

function extractCompanyFromTitle(title) {
  if (!title) return '';
  const companies = ['字节','豆包','百度','阿里','腾讯','智谱','月之暗面','Kimi','MiniMax','稀宇',
    'OpenAI','Google','Meta','Anthropic','Microsoft','Amazon','Apple','NVIDIA','xAI','Grok','ChatGPT','Claude','Gemini','Llama','Perplexity','Mistral',
    'Adobe','Salesforce','Oracle','IBM','Intel','AMD','Samsung','Sony','Tesla'];
  const t = title.toLowerCase();
  for (const c of companies) {
    if (t.includes(c.toLowerCase())) return c;
  }
  return '';
}

function normalizeSummary(summary) {
  if (!summary) return '暂无摘要';
  summary = summary.trim();
  
  // 检查是否以完整句子结尾（。！？）
  const sentenceEndings = /[。！？]$/;
  
  if (!sentenceEndings.test(summary)) {
    // 尝试在最后一个句子结束处截断（而不是在中间截断）
    const lastPeriod = Math.max(
      summary.lastIndexOf('。'),
      summary.lastIndexOf('！'),
      summary.lastIndexOf('？')
    );
    
    if (lastPeriod > 0) {
      // 保留到最后一个完整句子
      summary = summary.substring(0, lastPeriod + 1);
    }
    // 如果没有找到句子结束符，保留原文（可能是AI生成不完整，但不强行截断）
  }
  
  return summary;
}

async function summarizeSingle(item) {
  const prompt = `为以下新闻写中文标题、摘要和分类。

原文标题：${item.title}
内容摘要：${item.snippet}

输出JSON：
{"title_cn":"中文标题","summary":"摘要","category":"技术与研究","company":"公司名"}

【强制规则】
1. category只能是以下4个之一，不允许其他分类：
   - "产品发布与更新" → 新产品发布、功能更新、版本上线
   - "技术与研究" → 技术突破、论文、研究成果、算法改进
   - "投融资与并购" → 融资、投资、收购、IPO、估值
   - "政策与监管" → 政策法规、监管动态、合规、版权
   
2. 根据标题关键词判断：
   - 含"发布/上线/推出/更新"→产品发布与更新
   - 含"融资/投资/收购/并购/估值"→投融资与并购
   - 含"政策/法规/监管/合规"→政策与监管
   - 其他→技术与研究

3. summary必须是一段完整的新闻摘要（200-400字）：
   【重要】必须包含以下要素，不要遗漏：
   - 核心事件：谁做了什么（公司/机构名称、具体动作）
   - 关键数字：金额、用户数、增长率、时间点等所有具体数据
   - 背景信息：相关产品/业务的历史背景
   - 影响意义：对行业、公司、用户的意义
   【格式要求】
   - 必须用完整句子写成一段话
   - 必须写完，不能在句子中间截断
   - 结尾必须是句号、感叹号或问号
4. company从标题提取，没有就空字符串
5. 只输出JSON`;

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    
    return {
      ...item,
      title: parsed.title_cn || item.title,
      summary: normalizeSummary(parsed.summary),
      category: parsed.category || inferCategory(item.title),
      company: parsed.company || extractCompanyFromTitle(item.title)
    };
  } catch (error) {
    return {
      ...item,
      summary: normalizeSummary(item.snippet),
      category: inferCategory(item.title),
      company: extractCompanyFromTitle(item.title)
    };
  }
}

async function summarizeBatch(items) {
  if (items.length === 0) return [];
  
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPrompt = batch.map((item, idx) => 
      `[${idx+1}] 标题：${item.title}\n内容：${item.snippet?.substring(0, 300)}`
    ).join('\n\n');
    
    const prompt = `为以下${batch.length}条新闻写中文标题和摘要。

${batchPrompt}

输出JSON数组：
[{"title_cn":"中文标题","summary":"摘要","category":"技术与研究","company":"公司名"}]

【强制规则】
1. category只能是这4个之一："产品发布与更新"、"技术与研究"、"投融资与并购"、"政策与监管"
2. 判断标准：
   - 发布/上线/更新→产品发布与更新
   - 融资/投资/收购→投融资与并购
   - 政策/法规/监管→政策与监管
   - 其他→技术与研究
3. summary必须是一段完整的新闻摘要（200-400字）：
   - 必须包含：核心事件、关键数字、背景信息、影响意义
   - 必须用完整句子写成，不能在句子中间截断
   - 结尾必须是句号、感叹号或问号
4. 只输出JSON`;

    try {
      const response = await callDeepSeek(prompt);
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        for (let j = 0; j < batch.length; j++) {
          const origItem = batch[j];
          const aiItem = parsed[j] || {};
          
          results.push({
            ...origItem,
            title: aiItem.title_cn || origItem.title,
            summary: normalizeSummary(aiItem.summary),
            category: aiItem.category || inferCategory(origItem.title),
            company: aiItem.company || extractCompanyFromTitle(origItem.title)
          });
        }
      }
    } catch (error) {
      for (const item of batch) {
        results.push({
          ...item,
          summary: normalizeSummary(item.snippet),
          category: inferCategory(item.title),
          company: extractCompanyFromTitle(item.title)
        });
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

export async function summarizeNews({ domestic, overseas }) {
  console.log('\n🤖 AI总结中...');
  
  // 限制数量
  const domesticItems = domestic.slice(0, 25);
  const overseasItems = overseas.slice(0, 35);
  
  // 国内逐条总结
  const domesticSummaries = [];
  for (const item of domesticItems) {
    const summary = await summarizeSingle(item);
    domesticSummaries.push(summary);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 海外批量总结
  const overseasSummaries = await summarizeBatch(overseasItems);
  
  console.log(`   国内: ${domesticSummaries.length} 条`);
  console.log(`   海外: ${overseasSummaries.length} 条`);
  
  return [...domesticSummaries, ...overseasSummaries];
}
