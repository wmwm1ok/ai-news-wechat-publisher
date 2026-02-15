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

/**
 * 从标题推断分类
 */
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

/**
 * 从标题提取公司名
 */
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

/**
 * 从标题提取标签
 */
function extractTagsFromTitle(title) {
  if (!title) return ['AI'];
  const tags = [];
  const keywords = ['AI','大模型','GPT','Claude','Gemini','LLM','多模态','生成式','Agent','芯片','自动驾驶','机器人','深度学习'];
  const t = title.toLowerCase();
  for (const k of keywords) {
    if (t.includes(k.toLowerCase())) tags.push(k);
  }
  return tags.length > 0 ? tags.slice(0, 3) : ['AI'];
}

/**
 * 单条新闻总结 - 标题永远用原始标题
 */
async function summarizeSingle(item) {
  const prompt = `为以下新闻写摘要和分类。\n\n原文标题：${item.title}\n内容摘要：${item.snippet}\n\n输出JSON（严格格式）：\n{"summary":"120-180字专业摘要","category":"产品发布与更新/技术与研究/投融资与并购/政策与监管","company":"公司名","tags":["标签1","标签2"]}\n\n规则：\n1. summary必须基于输入内容，严禁编造\n2. category判断：发布/更新→产品发布与更新；融资/并购→投融资与并购；政策/法规→政策与监管；其他→技术与研究\n3. 只输出JSON，不要其他内容`;

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    
    return {
      title: item.title,  // 永远使用原始标题
      summary: parsed.summary || item.snippet?.substring(0, 200) || '暂无摘要',
      category: parsed.category || inferCategory(item.title),
      company: parsed.company || extractCompanyFromTitle(item.title),
      tags: parsed.tags || extractTagsFromTitle(item.title),
      source: item.source,
      publishedAt: item.publishedAt,
      url: item.url,
      region: '国内'
    };
  } catch (error) {
    console.warn(`AI总结失败，使用原始数据: ${item.title.substring(0, 30)}...`);
    return {
      title: item.title,
      summary: item.snippet?.substring(0, 200) || '暂无摘要',
      category: inferCategory(item.title),
      company: extractCompanyFromTitle(item.title),
      tags: extractTagsFromTitle(item.title),
      source: item.source,
      publishedAt: item.publishedAt,
      url: item.url,
      region: '国内'
    };
  }
}

/**
 * 批量总结海外新闻 - 标题永远用原始标题
 */
async function summarizeOverseasBatch(items) {
  if (items.length === 0) return [];
  
  // 分批处理，每批5条
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPrompt = batch.map((item, idx) => 
      `[${idx+1}] 标题：${item.title}\n内容：${item.snippet?.substring(0, 300)}`
    ).join('\n\n');
    
    const prompt = `为以下${batch.length}条海外AI新闻写中文摘要和分类。\n\n${batchPrompt}\n\n输出JSON数组（严格格式）：\n[{"summary":"摘要","category":"分类","company":"公司","tags":["标签"]}]\n\n规则：\n1. summary必须基于输入内容，严禁编造\n2. category只能是：产品发布与更新、技术与研究、投融资与并购、政策与监管\n3. 只输出JSON数组，不要其他内容`;

    try {
      const response = await callDeepSeek(prompt);
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        for (let j = 0; j < batch.length; j++) {
          const origItem = batch[j];
          const aiItem = parsed[j] || {};
          results.push({
            title: origItem.title,  // 永远使用原始标题
            summary: aiItem.summary || origItem.snippet?.substring(0, 200) || '暂无摘要',
            category: aiItem.category || inferCategory(origItem.title),
            company: aiItem.company || extractCompanyFromTitle(origItem.title),
            tags: aiItem.tags || extractTagsFromTitle(origItem.title),
            source: origItem.source,
            publishedAt: origItem.publishedAt,
            url: origItem.url,
            region: '海外'
          });
        }
      }
    } catch (error) {
      console.warn(`批量总结失败，使用原始数据: ${error.message}`);
      // 失败时全部使用原始数据
      for (const item of batch) {
        results.push({
          title: item.title,
          summary: item.snippet?.substring(0, 200) || '暂无摘要',
          category: inferCategory(item.title),
          company: extractCompanyFromTitle(item.title),
          tags: extractTagsFromTitle(item.title),
          source: item.source,
          publishedAt: item.publishedAt,
          url: item.url,
          region: '海外'
        });
      }
    }
    
    // 延迟避免 rate limit
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

/**
 * 均衡选择新闻（确保各分类都有内容，国内外 50/50）
 */
function selectBalancedNews(domestic, overseas) {
  const targetTotal = 12;
  const targetPerRegion = 6;
  const categories = ['产品发布与更新', '技术与研究', '投融资与并购', '政策与监管'];
  const selected = [];
  const selectedUrls = new Set();
  
  const selectUnique = (list) => {
    for (const item of list) {
      if (!selectedUrls.has(item.url)) {
        selected.push(item);
        selectedUrls.add(item.url);
        return true;
      }
    }
    return false;
  };
  
  // 第一轮：每个分类各选1条国内+1条海外
  for (const cat of categories) {
    const catDomestic = domestic.filter(d => d.category === cat);
    const catOverseas = overseas.filter(o => o.category === cat);
    
    if (selected.filter(s => s.region === '国内').length < targetPerRegion) {
      const ok = selectUnique(catDomestic);
      if (!ok) selectUnique(domestic); // 如果该分类没有，从所有国内选
    }
    if (selected.filter(s => s.region === '海外').length < targetPerRegion) {
      const ok = selectUnique(catOverseas);
      if (!ok) selectUnique(overseas); // 如果该分类没有，从所有海外选
    }
  }
  
  // 第二轮：填充国内到6条
  while (selected.filter(s => s.region === '国内').length < targetPerRegion) {
    const remaining = domestic.filter(d => !selectedUrls.has(d.url));
    if (!selectUnique(remaining)) break;
  }
  
  // 第三轮：填充海外到6条
  while (selected.filter(s => s.region === '海外').length < targetPerRegion) {
    const remaining = overseas.filter(o => !selectedUrls.has(o.url));
    if (!selectUnique(remaining)) break;
  }
  
  // 第四轮：补满12条（不区分国内外）
  while (selected.length < targetTotal) {
    const allRemaining = [...domestic, ...overseas].filter(i => !selectedUrls.has(i.url));
    if (!selectUnique(allRemaining)) break;
  }
  
  console.log(`   选择结果: 国内 ${selected.filter(s => s.region === '国内').length} 条, 海外 ${selected.filter(s => s.region === '海外').length} 条, 总计 ${selected.length} 条`);
  return selected;
}

/**
 * 总结所有新闻
 */
export async function summarizeNews({ domestic, overseas }) {
  console.log('\n🤖 开始 AI 总结...');
  console.log(`   国内候选: ${domestic.length} 条`);
  console.log(`   海外候选: ${overseas.length} 条\n`);
  
  // 限制处理数量
  const domesticToProcess = domestic.slice(0, 10);
  const overseasToProcess = overseas.slice(0, 25);
  
  // 国内新闻：逐条总结
  console.log(`正在总结 ${domesticToProcess.length} 条国内新闻...`);
  const domesticSummaries = [];
  for (const item of domesticToProcess) {
    const summary = await summarizeSingle(item);
    if (summary) domesticSummaries.push(summary);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 海外新闻：批量总结
  console.log(`正在总结 ${overseasToProcess.length} 条海外新闻...`);
  const overseasSummaries = await summarizeOverseasBatch(overseasToProcess);
  
  console.log(`\n✅ 总结完成:`);
  console.log(`   国内: ${domesticSummaries.length} 条`);
  console.log(`   海外: ${overseasSummaries.length} 条\n`);
  
  // 使用平衡选择算法：确保6国内+6海外
  const balancedNews = selectBalancedNews(domesticSummaries, overseasSummaries);
  
  // 按分类分组
  const grouped = {};
  SECTION_ORDER.forEach(section => {
    grouped[section] = balancedNews.filter(item => item.category === section);
  });
  
  const total = Object.values(grouped).flat().length;
  console.log(`📊 最终输出: ${total} 条新闻`);
  
  return grouped;
}
