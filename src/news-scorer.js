/**
 * 新闻质量评分系统 - 实质性内容优先
 */

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
 * 检查是否重复/相似
 */
function isDuplicate(title, existingTitles) {
  const normalized = title.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
  
  for (const existing of existingTitles) {
    const existingNorm = existing.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
    
    // 计算相似度
    let common = 0;
    for (let i = 0; i < Math.min(normalized.length, existingNorm.length); i++) {
      if (normalized[i] === existingNorm[i]) common++;
    }
    const similarity = common / Math.max(normalized.length, existingNorm.length);
    
    if (similarity > 0.6) return true;
  }
  
  return false;
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
 */
export function selectTopNews(newsList, targetCount = 12) {
  const existingTitles = [];
  const scored = [];
  
  // 评分
  for (const news of newsList) {
    const scoring = scoreNews(news, existingTitles);
    if (!scoring.isDuplicate) {
      scored.push({ ...news, ...scoring });
      existingTitles.push(news.title);
    }
  }
  
  // 按分数排序
  scored.sort((a, b) => b.score - a.score);
  
  // 选择时确保多样性
  const selected = [];
  const sourceCount = {};
  const categoryCount = {};
  
  // 第一轮：严格筛选（每个源最多2条，每个分类最多3条）
  for (const news of scored) {
    if (selected.length >= targetCount) break;
    if (news.score < 25) continue; // 质量门槛
    
    const source = news.source;
    const category = news.category || '技术与研究';
    
    if ((sourceCount[source] || 0) >= 2) continue;
    if ((categoryCount[category] || 0) >= 3) continue;
    
    selected.push(news);
    sourceCount[source] = (sourceCount[source] || 0) + 1;
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }
  
  // 第二轮：放宽条件填满
  for (const news of scored) {
    if (selected.length >= targetCount) break;
    if (selected.includes(news)) continue;
    if ((sourceCount[news.source] || 0) >= 3) continue;
    
    selected.push(news);
    sourceCount[news.source] = (sourceCount[news.source] || 0) + 1;
  }
  
  // 统计
  console.log('\n📊 质量评分统计:');
  console.log(`   候选: ${scored.length} 条`);
  console.log(`   入选: ${selected.length} 条`);
  console.log(`   平均分: ${(selected.reduce((a, b) => a + b.score, 0) / selected.length).toFixed(1)}`);
  console.log('   源分布:', Object.entries(sourceCount).map(([s, c]) => `${s}:${c}`).join(', '));
  
  return selected;
}
