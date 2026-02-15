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
        max_tokens: 2000
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
  
  // 如果超过140字，在完整句子处截断
  if (summary.length > 140) {
    // 在100-140字范围内找最后一个句号
    const searchText = summary.substring(100, 140);
    const lastPeriod = searchText.lastIndexOf('。');
    
    if (lastPeriod !== -1) {
      // 在句子结束处截断
      summary = summary.substring(0, 100 + lastPeriod + 1);
    } else {
      // 找不到句号，截断到120字并加省略号
      summary = summary.substring(0, 120) + '...';
    }
  }
  
  return summary;
}

async function summarizeSingle(item) {
  const prompt = `为以下新闻写中文标题、摘要和分类。

原文标题：${item.title}
内容摘要：${item.snippet}

输出JSON：
{"title_cn":"中文标题（简洁专业）","summary":"摘要","category":"产品发布与更新/技术与研究/投融资与并购/政策与监管","company":"公司名（没有就空字符串）"}

规则：
1. title_cn：将原文翻译为简洁中文标题
2. summary：写一段完整的摘要，把事情说清楚。不要过长（控制在150字以内），但也不要太短。必须在完整句子处结束，不要话说到一半就断掉。
3. company：提取公司名，未提及则返回空字符串
4. 只输出JSON`;

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
[{"title_cn":"中文标题","summary":"摘要","category":"分类","company":"公司名"}]

规则：
1. title_cn：翻译为简洁中文
2. summary：写完整的摘要把事情说清楚，控制在150字以内，必须在完整句子处结束
3. 只输出JSON`;

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
  const domesticItems = domestic.slice(0, 15);
  const overseasItems = overseas.slice(0, 20);
  
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
