/**
 * 新闻质量评分系统
 * 多维度评估新闻价值
 */

// 关键词权重 - 核心价值事件
const IMPACT_KEYWORDS = {
  // 最高权重 - 行业里程碑
  10: ['GPT-5', 'GPT-4.5', 'AGI', 'ASI', '通用人工智能', '发布', '上线', '开源'],
  // 高权重 - 重要产品/技术
  8: ['Claude', 'Gemini', 'Llama 3', 'Sora', '重磅', '突破', '首次'],
  // 中高权重 - 融资/大公司动态
  6: ['融资', 'OpenAI', 'Meta', 'Google', 'Microsoft', 'Amazon', 'IPO', '收购', '并购'],
  // 中等权重 - 技术进展
  4: ['论文', '研究', '算法', '模型', '性能提升', '基准测试'],
  // 低权重 - 普通更新
  2: ['更新', '优化', '改进', '功能']
};

// 来源可信度评分
const SOURCE_CREDIBILITY = {
  // 国内权威
  '机器之心': 9,
  '量子位': 9,
  '36氪': 7,
  'InfoQ': 8,
  // 海外权威
  'TechCrunch': 8,
  'The Verge': 7,
  'MIT Technology Review': 9,
  'Wired': 7,
  'VentureBeat': 6,
  'Ars Technica': 7,
  'ZDNet': 5
};

/**
 * 计算新闻影响力评分
 */
function calculateImpactScore(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  let score = 0;
  let matchedKeywords = [];
  
  for (const [weight, keywords] of Object.entries(IMPACT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += parseInt(weight);
        matchedKeywords.push(keyword);
      }
    }
  }
  
  return { score: Math.min(score, 25), keywords: matchedKeywords };
}

/**
 * 计算新颖度评分
 * 基于标题独特性和技术前沿性
 */
function calculateNoveltyScore(title, existingTitles) {
  // 检查是否与已有新闻相似
  const normalized = title.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
  
  for (const existing of existingTitles) {
    const existingNorm = existing.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
    // 相似度检查
    if (similarity(normalized, existingNorm) > 0.6) {
      return { score: 0, reason: '相似新闻已存在' };
    }
  }
  
  // 前沿技术加分
  let score = 5; // 基础分
  const frontierTerms = ['多模态', 'Agent', '具身智能', '世界模型', '推理', 'RAG'];
  for (const term of frontierTerms) {
    if (title.toLowerCase().includes(term.toLowerCase())) {
      score += 3;
    }
  }
  
  return { score: Math.min(score, 15), reason: '新颖内容' };
}

/**
 * 计算时效性评分
 * 越新分数越高
 */
function calculateTimelinessScore(publishedAt) {
  const hoursAgo = (new Date() - new Date(publishedAt)) / (1000 * 60 * 60);
  
  if (hoursAgo < 6) return 10;  // 6小时内 - 最热
  if (hoursAgo < 12) return 8;  // 12小时内
  if (hoursAgo < 24) return 6;  // 24小时内
  if (hoursAgo < 36) return 4;  // 36小时内
  return 2; // 更旧的
}

/**
 * 综合评分
 */
export function scoreNews(news, existingTitles) {
  const impact = calculateImpactScore(news.title, news.snippet || '');
  const novelty = calculateNoveltyScore(news.title, existingTitles);
  const timeliness = calculateTimelinessScore(news.publishedAt);
  const credibility = SOURCE_CREDIBILITY[news.source] || 5;
  
  // 国内新闻稍微加分（读者更关注）
  const regionBonus = news.region === '国内' ? 2 : 0;
  
  const totalScore = impact.score + novelty.score + timeliness + credibility + regionBonus;
  
  return {
    score: totalScore,
    breakdown: {
      impact: impact.score,
      novelty: novelty.score,
      timeliness,
      credibility,
      regionBonus
    },
    matchedKeywords: impact.keywords,
    noveltyReason: novelty.reason,
    isDuplicate: novelty.score === 0
  };
}

/**
 * 简单字符串相似度
 */
function similarity(s1, s2) {
  if (s1 === s2) return 1;
  if (s1.length < 3 || s2.length < 3) return 0;
  
  // 计算共同子串比例
  let common = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) common++;
  }
  return common / Math.max(s1.length, s2.length);
}

/**
 * 智能排序和选择
 * 确保多样性 + 高质量
 */
export function selectTopNews(newsList, targetCount = 12) {
  const existingTitles = [];
  const scored = [];
  
  // 给所有新闻打分
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
  const categoryCount = {
    '产品发布与更新': 0,
    '技术与研究': 0,
    '投融资与并购': 0,
    '政策与监管': 0
  };
  
  // 第一轮：确保每个分类至少1条，每个源最多2条
  for (const news of scored) {
    if (selected.length >= targetCount) break;
    
    const source = news.source;
    const category = news.category || '技术与研究';
    
    if ((sourceCount[source] || 0) >= 2) continue;
    if (categoryCount[category] >= 4) continue;
    
    selected.push(news);
    sourceCount[source] = (sourceCount[source] || 0) + 1;
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }
  
  // 第二轮：填满剩余位置
  for (const news of scored) {
    if (selected.length >= targetCount) break;
    if (selected.includes(news)) continue;
    if ((sourceCount[news.source] || 0) >= 3) continue;
    
    selected.push(news);
    sourceCount[news.source] = (sourceCount[news.source] || 0) + 1;
  }
  
  console.log('\n📊 新闻评分统计:');
  console.log(`   候选总数: ${scored.length}`);
  console.log(`   入选数量: ${selected.length}`);
  console.log(`   平均分数: ${(selected.reduce((a, b) => a + b.score, 0) / selected.length).toFixed(1)}`);
  console.log('   源分布:', Object.entries(sourceCount).map(([s, c]) => `${s}:${c}`).join(', '));
  
  return selected;
}
