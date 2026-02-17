/**
 * 新闻质量评分系统 - 实质性内容优先
 */

import { DeduplicationEngine } from './deduplication-engine.js';

// 全局去重引擎实例
const dedupEngine = new DeduplicationEngine();

// 实质性指标 - 有具体数据/行动
const SUBSTANCE_INDICATORS = {
  // 具体数字（金额、百分比、版本号等）
  hasNumbers: (text) => {
    const matches = text.match(/\d+\.?\d*\s*(亿|万|千|百|美元|元|%|倍|个|次|TB|GB|秒|分钟|小时)/g);
    return matches ? Math.min(matches.length * 3, 10) : 0;
  },
  
  // 具体行动词（已完成，不是计划）
  actionWords: (text) => {
    const actions = ['发布', '上线', '开源', '推出', '推出', '完成', '实现', '突破', '收购', '投资', '融资', '达成'];
    let score = 0;
    for (const word of actions) {
      if (text.includes(word)) score += 4;
    }
    return Math.min(score, 12);
  },
  
  // 负面指标 - 模糊/计划性词汇
  vaguePenalty: (text) => {
    const vagueWords = ['计划', '将', '可能', '或许', '考虑', '拟', '预计', '有望', '或', '传', '据悉', '知情人士'];
    let penalty = 0;
    for (const word of vagueWords) {
      if (text.includes(word)) penalty += 3;
    }
    return -Math.min(penalty, 15);
  },
  
  // 技术深度指标
  technicalDepth: (text) => {
    const techTerms = ['论文', 'arXiv', 'GitHub', '开源', '代码', '模型', '算法', '架构', '训练', '数据集', '基准测试', '准确率', '性能提升'];
    let score = 0;
    for (const term of techTerms) {
      if (text.includes(term)) score += 3;
    }
    return Math.min(score, 15);
  }
};

// 来源可信度
const SOURCE_CREDIBILITY = {
  '机器之心': 9,
  '量子位': 9,
  'InfoQ': 8,
  '36氪': 7,
  'TechCrunch AI': 8,
  'MIT Technology Review': 10,
  'The Verge AI': 7,
  'VentureBeat AI': 7,
  'Wired AI': 7,
  'Serper': 6
};

/**
 * 计算内容实质性评分（0-40分）
 */
function calculateSubstanceScore(title, summary) {
  const text = title + ' ' + summary;
  
  let score = 0;
  score += SUBSTANCE_INDICATORS.hasNumbers(text);
  score += SUBSTANCE_INDICATORS.actionWords(text);
  score += SUBSTANCE_INDICATORS.vaguePenalty(text);
  score += SUBSTANCE_INDICATORS.technicalDepth(text);
  
  return Math.max(0, Math.min(score, 40));
}

/**
 * 计算重要性评分（0-30分）
 */
function calculateImportanceScore(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  let score = 0;
  
  // 头部公司动态
  const topCompanies = ['openai', 'google', 'meta', 'anthropic', 'microsoft', 'nvidia', '字节', '阿里', '腾讯', '百度'];
  for (const company of topCompanies) {
    if (text.includes(company.toLowerCase())) {
      score += 5;
      break; // 只算一次
    }
  }
  
  // 重要产品/技术
  if (text.includes('gpt-4') || text.includes('gpt-5') || text.includes('claude 3') || text.includes('gemini')) score += 6;
  if (text.includes('agi') || text.includes('开源') || text.includes('突破')) score += 5;
  
  // 大额融资
  if (text.includes('融资') && (text.includes('亿') || text.includes('billion'))) score += 8;
  
  return Math.min(score, 30);
}

/**
 * 计算时效性（0-10分）
 */
function calculateTimeliness(publishedAt) {
  const hoursAgo = (new Date() - new Date(publishedAt)) / (1000 * 60 * 60);
  
  if (hoursAgo < 6) return 10;
  if (hoursAgo < 12) return 8;
  if (hoursAgo < 24) return 6;
  if (hoursAgo < 36) return 4;
  return 2;
}

/**
 * 使用语义指纹引擎检查重复
 * 保留旧函数名以保持向后兼容
 */
function isDuplicate(title, existingTitles) {
  const result = dedupEngine.checkDuplicate(title, existingTitles);
  return result.isDuplicate;
}

/**
 * 智能语义去重 - 基于URL、标题和摘要的综合判断
 * @param {Object} news - 当前新闻 {title, url, summary}
 * @param {Array} existingNews - 已有新闻列表 [{title, url, summary}, ...]
 * @returns {Object} {isDuplicate, reason, confidence}
 */
export function checkSemanticDuplicate(news, existingNews) {
  if (!news || !existingNews || existingNews.length === 0) {
    return { isDuplicate: false, reason: '无需检查', confidence: 1 };
  }
  
  const currentUrl = (news.url || '').trim();
  const currentTitle = (news.title || '').trim();
  const currentSummary = (news.summary || '').trim();
  
  for (const existing of existingNews) {
    const existingUrl = (existing.url || '').trim();
    const existingTitle = (existing.title || '').trim();
    const existingSummary = (existing.summary || '').trim();
    
    // 1. URL 完全匹配（最可靠）
    if (currentUrl && existingUrl && currentUrl === existingUrl) {
      return { 
        isDuplicate: true, 
        reason: 'URL相同', 
        confidence: 1.0,
        matchedWith: existingTitle
      };
    }
    
    // 2. 标题完全匹配
    if (currentTitle.toLowerCase() === existingTitle.toLowerCase()) {
      return { 
        isDuplicate: true, 
        reason: '标题完全相同', 
        confidence: 1.0,
        matchedWith: existingTitle
      };
    }
    
    // 3. 标题语义指纹匹配
    const titleResult = dedupEngine.checkDuplicate(currentTitle, [existingTitle]);
    if (titleResult.isDuplicate) {
      return { 
        isDuplicate: true, 
        reason: `标题语义相似 (${titleResult.reason})`, 
        confidence: titleResult.confidence,
        matchedWith: existingTitle
      };
    }
    
    // 4. 摘要语义匹配（如果摘要不空）
    if (currentSummary && existingSummary) {
      // 提取摘要的核心实体和关键词
      const currentEntities = extractCoreEntities(currentTitle + ' ' + currentSummary);
      const existingEntities = extractCoreEntities(existingTitle + ' ' + existingSummary);
      
      // 计算实体重叠度
      const commonEntities = currentEntities.filter(e => existingEntities.includes(e));
      const entityOverlap = commonEntities.length / Math.max(currentEntities.length, existingEntities.length);
      
      // 如果实体重叠度高且涉及相同公司/产品，认为是重复
      if (entityOverlap >= 0.6 && commonEntities.length >= 2) {
        return { 
          isDuplicate: true, 
          reason: '内容实体高度重叠', 
          confidence: entityOverlap,
          matchedWith: existingTitle,
          commonEntities
        };
      }
    }
  }
  
  return { isDuplicate: false, reason: '未检测到重复', confidence: 1 };
}

/**
 * 提取文本中的核心实体（公司、产品、技术、人名）
 */
function extractCoreEntities(text) {
  if (!text) return [];
  
  const entities = [];
  const lowerText = text.toLowerCase();
  
  // 公司/组织名
  const companies = [
    'openai', 'anthropic', 'google', 'meta', 'microsoft', 'nvidia', 'amazon', 'apple', 'intel', 'amd',
    '字节', '字节跳动', '阿里', '阿里巴巴', '腾讯', '百度', '华为', '小米', '美团', '滴滴', '京东', '网易', '快手', '拼多多',
    '商汤', '旷视', '依图', '云从', '科大讯飞', '讯飞', '智谱', '月之暗面', 'minimax', '零一万物',
    '百川智能', '面壁智能', '深度求索', 'deepseek', '极佳视界', '澜舟科技', '思必驰', '云知声',
    '第四范式', '出门问问', '循环智能', '智源研究院', '清华', '北大', '中科院', '斯坦福', 'mit'
  ];
  
  // 产品/模型名
  const products = [
    'gpt-4', 'gpt-5', 'gpt-4o', 'claude', 'gemini', 'llama', 'mistral', 'mixtral',
    'gpt', 'dall-e', 'sora', 'whisper', 'qwen', 'baichuan', 'chatglm', 'internlm',
    'yi', 'skywork', 'bluelm', 'deepseek', 'kimi', '豆包', '文心一言', '通义千问',
    'gigabrain', 'vla', 'moco', 'seedance'
  ];
  
  // 技术术语
  const techTerms = [
    '大模型', 'llm', 'ai', '人工智能', '神经网络', '深度学习', '机器学习',
    '多模态', 'transformer', 'diffusion', '强化学习', 'rlhf', 'rag',
    '具身智能', '生成式ai', 'ag'
  ];
  
  // 人名
  const persons = [
    'sam altman', '奥特曼', '李彦宏', '马云', '马化腾', '雷军', '张一鸣',
    '梁文锋', '李飞飞', 'andrej karpathy', 'karpathy', 'jeff dean', '黄仁勋'
  ];
  
  // 检查匹配
  for (const c of companies) {
    if (lowerText.includes(c.toLowerCase())) entities.push(c);
  }
  for (const p of products) {
    if (lowerText.includes(p.toLowerCase())) entities.push(p);
  }
  for (const t of techTerms) {
    if (lowerText.includes(t.toLowerCase())) entities.push(t);
  }
  for (const p of persons) {
    if (lowerText.includes(p.toLowerCase())) entities.push(p);
  }
  
  return [...new Set(entities)]; // 去重
}

/**
 * 综合评分
 */
export function scoreNews(news, existingTitles) {
  // 检查重复
  if (isDuplicate(news.title, existingTitles)) {
    return { score: 0, isDuplicate: true, reason: '重复新闻' };
  }
  
  // 非AI新闻过滤（简单检查）
  const nonAIIndicators = ['旅游', '酒店', '餐饮', '电影', '娱乐', '体育', '天气'];
  for (const indicator of nonAIIndicators) {
    if (news.title.includes(indicator) && !news.title.includes('AI') && !news.title.includes('智能')) {
      return { score: 0, isDuplicate: true, reason: '非AI新闻' };
    }
  }
  
  const substance = calculateSubstanceScore(news.title, news.summary);
  const importance = calculateImportanceScore(news.title, news.summary);
  const timeliness = calculateTimeliness(news.publishedAt);
  const credibility = SOURCE_CREDIBILITY[news.source] || 5;
  
  const totalScore = substance + importance + timeliness + credibility;
  
  return {
    score: totalScore,
    breakdown: {
      substance,
      importance,
      timeliness,
      credibility
    },
    isDuplicate: false
  };
}

/**
 * 智能选择TOP新闻
 * @param {Array} newsList - 新闻列表
 * @param {number} targetCount - 目标数量（注：实际范围 12-15，1:1 国内外比例）
 * @param {Array} previousNews - 之前已抓取的新闻 [{title, url, summary}, ...]（用于跨天去重）
 */
export function selectTopNews(newsList, targetCount = 12, previousNews = []) {
  // targetCount 参数保留兼容，实际内部使用 12-15 范围
  // previousNews 是对象数组，需要提取标题用于当天去重
  const previousTitles = previousNews.map(n => n.title);
  const existingNews = []; // 已处理的新闻（包含完整信息）
  const scored = [];
  const duplicates = [];
  const crossDayDuplicates = []; // 跨天重复统计
  
  // 评分
  for (const news of newsList) {
    // 使用语义去重检查（包含 URL、标题、摘要）
    const duplicateCheck = checkSemanticDuplicate(news, [...previousNews, ...existingNews]);
    
    // 检查是否是跨天重复
    let isCrossDayDup = false;
    if (previousNews.length > 0 && duplicateCheck.isDuplicate) {
      // 检查是否匹配到昨天的新闻
      const yesterdayCheck = checkSemanticDuplicate(news, previousNews);
      if (yesterdayCheck.isDuplicate) {
        isCrossDayDup = true;
        crossDayDuplicates.push({
          title: news.title,
          source: news.source,
          reason: yesterdayCheck.reason,
          matchedWith: yesterdayCheck.matchedWith || '昨日新闻'
        });
      }
    }
    
    if (duplicateCheck.isDuplicate) {
      duplicates.push({ 
        title: news.title, 
        source: news.source, 
        reason: duplicateCheck.reason,
        isCrossDay: isCrossDayDup
      });
    } else {
      // 当天去重仍使用标题（确保当天不重复）
      const scoring = scoreNews(news, existingNews.map(n => n.title));
      if (!scoring.isDuplicate) {
        scored.push({ ...news, ...scoring });
        existingNews.push({
          title: news.title,
          url: news.url,
          summary: news.summary
        });
      }
    }
  }
  
  // 输出去重报告
  if (duplicates.length > 0) {
    console.log(`\n🔄 去重统计: 过滤掉 ${duplicates.length} 条重复新闻`);
    const crossDayCount = crossDayDuplicates.length;
    if (crossDayCount > 0) {
      console.log(`   📅 其中 ${crossDayCount} 条与昨日新闻重复`);
    }
    for (const dup of duplicates.slice(0, 5)) {
      const crossDayMark = dup.isCrossDay ? '📅 ' : '';
      console.log(`   ❌ ${crossDayMark}[${dup.source}] ${dup.title.slice(0, 60)}... (${dup.reason})`);
    }
    if (duplicates.length > 5) {
      console.log(`   ... 还有 ${duplicates.length - 5} 条`);
    }
  }
  
  // 按分数排序
  scored.sort((a, b) => b.score - a.score);
  
  // 选择时确保多样性，并严格平衡国内外比例（目标 1:1）
  // 目标数量范围 12-15 条，1:1 比例即每区域 6-8 条
  const selected = [];
  const sourceCount = {};
  const categoryCount = {};
  const minTarget = 12;
  const maxTarget = 15;
  const maxPerRegion = Math.floor(maxTarget / 2); // 每区域最多7-8条
  
  // 第一轮：严格筛选，强制 1:1 比例
  for (const news of scored) {
    if (selected.length >= maxTarget) break;
    if (news.score < 20) continue; // 降低质量门槛让更多海外新闻有机会
    
    const source = news.source;
    const category = news.category || '技术与研究';
    const region = news.region || '国内';
    
    // 源和分类限制
    if ((sourceCount[source] || 0) >= 2) continue;
    if ((categoryCount[category] || 0) >= 4) continue;
    
    // 严格区域平衡：每区域最多 maxPerRegion 条
    const currentRegionCount = selected.filter(n => (n.region || '国内') === region).length;
    if (currentRegionCount >= maxPerRegion) continue;
    
    selected.push(news);
    sourceCount[source] = (sourceCount[source] || 0) + 1;
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }
  
  // 第二轮：填补空缺，优先补充数量少的区域
  for (const news of scored) {
    if (selected.length >= maxTarget) break;
    if (selected.includes(news)) continue;
    if (news.score < 10) continue;
    if ((sourceCount[news.source] || 0) >= 2) continue;
    
    const region = news.region || '国内';
    const currentRegionCount = selected.filter(n => (n.region || '国内') === region).length;
    
    // 如果该区域已满，跳过
    if (currentRegionCount >= maxPerRegion + 1) continue;
    
    selected.push(news);
    sourceCount[news.source] = (sourceCount[news.source] || 0) + 1;
  }
  
  // 第三轮：确保填满目标数量（比例放宽）
  for (const news of scored) {
    if (selected.length >= maxTarget) break;
    if (selected.includes(news)) continue;
    if (news.score < 5) continue;
    if ((sourceCount[news.source] || 0) >= 2) continue;
    
    selected.push(news);
    sourceCount[news.source] = (sourceCount[news.source] || 0) + 1;
  }
  
  // 第四轮：最后手段
  for (const news of scored) {
    if (selected.length >= maxTarget) break;
    if (selected.includes(news)) continue;
    if ((sourceCount[news.source] || 0) >= 3) continue;
    
    selected.push(news);
    sourceCount[news.source] = (sourceCount[news.source] || 0) + 1;
  }
  
  // 统计
  const domesticCount = selected.filter(n => (n.region || '国内') === '国内').length;
  const overseasCount = selected.filter(n => n.region === '海外').length;
  
  console.log('\n📊 质量评分统计:');
  console.log(`   候选: ${scored.length} 条`);
  console.log(`   入选: ${selected.length} 条 (🇨🇳${domesticCount}/🇺🇸${overseasCount})`);
  console.log(`   平均分: ${(selected.reduce((a, b) => a + b.score, 0) / selected.length).toFixed(1)}`);
  console.log('   源分布:', Object.entries(sourceCount).map(([s, c]) => `${s}:${c}`).join(', '));
  
  return selected;
}
