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
  const prompt = `你是一名资深AI行业新闻编辑，为专业读者提供简洁、准确的新闻摘要。

【角色定位】
- 风格：专业、客观、简洁，避免标题党和情绪化表达
- 读者：AI从业者、投资人、行业研究员
- 要求：提供有价值的信息密度，去除营销话术

【绝对禁止】
- 禁止编造任何新闻事实
- 禁止将旧闻改写成"今日发布"
- 禁止添加原文中没有的信息
- 禁止使用"震惊""炸了""爆火"等情绪化词汇
- 必须严格基于输入的新闻内容总结

【分类规则】
从以下四类中选择一个最贴切的：
- 产品发布与更新：新产品、功能更新、版本发布
- 技术与研究：论文、技术突破、研究成果、开源项目
- 投融资与并购：融资、投资、并购、IPO
- 政策与监管：法规、政策、监管动态、合规要求

【输出格式】
严格 JSON，不要 Markdown，不要代码块：
{
  "title": "新闻标题（去除营销词汇，保持专业简洁）",
  "company": "公司/机构名称（如字节跳动、OpenAI、Google等，从标题或摘要中提取）",
  "summary": "120-180字专业摘要，突出核心信息（公司/机构、产品/技术、关键数据、影响），避免无信息量的描述",
  "category": "分类名称",
  "source": "来源",
  "publishedAt": "发布时间",
  "tags": ["技术标签1", "技术标签2"]
}

【输入数据】
标题：${item.title}
来源：${item.source}
时间：${item.publishedAt}
摘要：${item.snippet}

请基于以上输入数据输出专业 JSON：`;

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

  const prompt = `你是资深 AI 行业新闻编辑，为专业读者筛选和总结海外 AI 新闻。

【角色定位】
- 风格：专业、客观、简洁，去除营销话术和情绪化表达
- 读者：AI从业者、投资人、技术研究员
- 要求：筛选真正有价值的新闻，提供信息密度高的摘要

【绝对禁止】
- 严禁编造任何新闻事实
- 严禁将历史旧闻改写成"今日发布"
- 严禁添加输入数据中没有的信息
- 严禁使用"震惊""炸了""爆火"等词汇

【筛选与去重标准】
1) 从 articles 中筛选最有价值的 10-12 条新闻
2) 优先选择：头部公司动态（OpenAI/Google/Meta等）、重要技术突破、大额融资、重大政策
3) 严格去重：同一事件的多条报道只保留最完整的一条（如"豆包2.0"的多篇报道只选1条）
4) 过滤掉：地方新闻、重复报道、营销软文、过于细分的技术细节
5) 确保四个分类都有内容：产品发布2-4条、技术研究2-4条、投融资1-3条、政策监管1-2条

【分类规则】
按以下 4 个模块分类（固定）：
   - 产品发布与更新：新产品、功能更新、版本发布（2-3条）
   - 技术与研究：论文、技术突破、研究成果（2-3条）
   - 投融资与并购：融资、投资、并购（1-2条）
   - 政策与监管：法规、监管动态（1-2条）

【输出要求】
- 严格 JSON，不要 Markdown，不要 \`\`\`
- 简体中文，保留常见英文术语
- 禁止输出 URL
- title_cn：专业简洁的标题，去除营销词汇
- summary：120-180字，突出核心信息（主体、动作、关键数据、影响）
- tags：2-3个技术标签
- published_at：保持原始时间

【输入数据】
${articlesJson}

JSON 结构：
{
  "date": "${dateStr}",
  "items": [
    {
      "section": "产品发布与更新",
      "company": "公司/机构名称（如OpenAI、Google、Meta等）",
      "title_cn": "中文标题",
      "summary": "120-180字专业摘要",
      "source": "来源",
      "published_at": "时间",
      "tags": ["标签1", "标签2"]
    }
  ]
}

请输出专业 JSON：`;

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
 * 均衡选择新闻（确保各分类都有内容）
 */
function selectBalancedNews(domestic, overseas) {
  // 目标：总共 12-15 条
  // 国内最多 7 条，海外最多 8 条
  const targetTotal = 14;
  const maxDomestic = 7;
  const maxOverseas = 8;
  
  // 优先选择每个分类的新闻
  const categories = ['产品发布与更新', '技术与研究', '投融资与并购', '政策与监管'];
  const selected = [];
  const selectedUrls = new Set();
  
  // 每个分类先选 1-2 条
  for (const cat of categories) {
    const catDomestic = domestic.filter(d => d.category === cat || !d.category);
    const catOverseas = overseas.filter(o => o.category === cat || !o.category);
    
    // 优先选国内
    if (catDomestic.length > 0 && selected.filter(s => s.region === '国内').length < maxDomestic) {
      const item = catDomestic[0];
      if (!selectedUrls.has(item.url)) {
        selected.push(item);
        selectedUrls.add(item.url);
      }
    }
    
    // 再选海外
    if (catOverseas.length > 0 && selected.filter(s => s.region === '海外').length < maxOverseas) {
      const item = catOverseas[0];
      if (!selectedUrls.has(item.url)) {
        selected.push(item);
        selectedUrls.add(item.url);
      }
    }
  }
  
  // 填充剩余位置
  const remaining = targetTotal - selected.length;
  if (remaining > 0) {
    const allRemaining = [...domestic, ...overseas].filter(i => !selectedUrls.has(i.url));
    const toAdd = allRemaining.slice(0, remaining);
    selected.push(...toAdd);
  }
  
  // 限制总数
  return selected.slice(0, targetTotal);
}

/**
 * 总结所有新闻
 */
export async function summarizeNews({ domestic, overseas }) {
  console.log('\n🤖 开始 AI 总结...');
  console.log(`   国内候选: ${domestic.length} 条`);
  console.log(`   海外候选: ${overseas.length} 条\n`);
  
  // 限制处理数量，确保最终输出 12-16 条
  const domesticToProcess = domestic.slice(0, 12);
  const overseasToProcess = overseas.slice(0, 14);
  
  // 国内新闻：逐条总结
  console.log(`正在总结 ${domesticToProcess.length} 条国内新闻...`);
  const domesticSummaries = [];
  for (const item of domesticToProcess) {
    const summary = await summarizeSingle(item);
    if (summary) {
      domesticSummaries.push(summary);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 海外新闻：批量总结
  console.log(`正在总结 ${overseasToProcess.length} 条海外新闻...`);
  const overseasSummaries = await summarizeOverseasBatch(overseasToProcess);
  
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
  
  // 限制每个分类的数量（确保总量 10-15 条）
  grouped['产品发布与更新'] = (grouped['产品发布与更新'] || []).slice(0, 4);
  grouped['技术与研究'] = (grouped['技术与研究'] || []).slice(0, 4);
  grouped['投融资与并购'] = (grouped['投融资与并购'] || []).slice(0, 4);
  grouped['政策与监管'] = (grouped['政策与监管'] || []).slice(0, 3);
  
  // 添加"其他"分类
  const otherNews = allNews.filter(item => !SECTION_ORDER.includes(item.category));
  if (otherNews.length > 0) {
    grouped['其他'] = otherNews.slice(0, 2);
  }
  
  // 统计总数
  const total = Object.values(grouped).flat().length;
  console.log(`📊 最终输出: ${total} 条新闻`);
  
  // 后处理：合并同一公司的重复新闻
  const finalGrouped = mergeDuplicateNews(grouped);
  
  // 重新统计
  const finalTotal = Object.values(finalGrouped).flat().length;
  console.log(`📊 去重后: ${finalTotal} 条新闻`);
  
  return finalGrouped;
}

/**
 * 合并相似新闻（针对同一公司的多条新闻）
 */
function mergeDuplicateNews(grouped) {
  const result = {};
  
  for (const [category, items] of Object.entries(grouped)) {
    if (!items || items.length === 0) {
      result[category] = [];
      continue;
    }
    
    const merged = [];
    const used = new Set();
    
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      
      const item = items[i];
      const duplicates = [item];
      
      // 查找相似的新闻（同一主题）
      for (let j = i + 1; j < items.length; j++) {
        if (used.has(j)) continue;
        
        const other = items[j];
        
        // 检查是否是同一主题（通过关键词匹配）
        const itemKeywords = extractKeywords(item.title);
        const otherKeywords = extractKeywords(other.title);
        const commonKeywords = itemKeywords.filter(k => otherKeywords.includes(k));
        
        // 去重规则：
        // 1. 3 个及以上共同关键词 -> 强重复
        // 2. 2 个共同关键词 + 标题相似度 > 50% -> 重复
        // 3. 同一公司 + 标题相似度 > 60% -> 重复（同一公司的不同产品保留）
        let isDuplicate = false;
        
        if (commonKeywords.length >= 3) {
          isDuplicate = true;
        } else if (commonKeywords.length === 2) {
          const sim = calculateSimilarity(item.title, other.title);
          if (sim > 0.5) {
            isDuplicate = true;
          }
        }
        
        // 同一公司严格去重（只去重高度相似的）
        const hasCompany = commonKeywords.some(k => 
          ['字节', '豆包', 'openai', 'google', 'meta', 'anthropic', '阿里', '百度', '腾讯'].includes(k)
        );
        if (hasCompany && !isDuplicate) {
          const sim = calculateSimilarity(item.title, other.title);
          // 只有高度相似才合并（避免合并同一公司的不同产品新闻）
          if (sim > 0.6) {
            isDuplicate = true;
            console.log(`     高度相似: "${other.title.substring(0, 30)}..." (相似度: ${sim.toFixed(2)})`);
          }
        }
        
        if (isDuplicate) {
          duplicates.push(other);
          used.add(j);
          console.log(`     相似: "${other.title.substring(0, 30)}..." (关键词: ${commonKeywords.join(', ')})`);
        }
      }
      
      // 如果有多条重复，保留最详细的一条
      if (duplicates.length > 1) {
        console.log(`   🔄 合并 ${duplicates.length} 条相似新闻: "${item.title.substring(0, 30)}..."`);
        // 选择摘要最长的一条
        const best = duplicates.reduce((best, current) => 
          (current.summary?.length || 0) > (best.summary?.length || 0) ? current : best
        );
        merged.push(best);
      } else {
        merged.push(item);
      }
      
      used.add(i);
    }
    
    result[category] = merged;
  }
  
  return result;
}

/**
 * 计算两个字符串的相似度（0-1）
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  
  // 提取中文词汇
  const words1 = s1.match(/[\u4e00-\u9fa5]+/g) || [];
  const words2 = s2.match(/[\u4e00-\u9fa5]+/g) || [];
  
  if (words1.length === 0 || words2.length === 0) {
    return s1.includes(s2) || s2.includes(s1) ? 0.8 : 0;
  }
  
  // 计算共同词汇比例
  const commonWords = words1.filter(w => words2.includes(w));
  const similarity = (2 * commonWords.length) / (words1.length + words2.length);
  
  return similarity;
}

/**
 * 提取标题关键词（用于去重）
 */
function extractKeywords(title) {
  if (!title) return [];
  
  const keywords = [];
  const text = title.toLowerCase();
  
  // 常见公司名（中文+英文）
  const companies = ['字节', '豆包', 'openai', 'google', 'meta', 'anthropic', '微软', '阿里', '百度', '腾讯', '智谱'];
  for (const company of companies) {
    if (text.includes(company.toLowerCase())) keywords.push(company);
  }
  
  // 产品名
  const products = ['gpt', 'claude', 'gemini', 'llama', 'kimi', '大模型', 'sora'];
  for (const product of products) {
    if (text.includes(product.toLowerCase())) keywords.push(product);
  }
  
  // 技术关键词（用于识别同一主题）
  const techTerms = ['亲吻数', 'kiss', ' RL ', '强化学习', 'agent', '智能体', '多模态', '情人节'];
  for (const term of techTerms) {
    if (text.includes(term.toLowerCase())) keywords.push(term);
  }
  
  // 数字（版本号、年份等）
  const versionMatch = title.match(/(\d+\.\d+|\d+代)/);
  if (versionMatch) keywords.push(versionMatch[0]);
  
  return [...new Set(keywords)];
}
