import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, POLICY_RSS_SOURCES, AI_KEYWORDS, CONFIG } from './config.js';

// Serper API 配置
const SERPER_API_URL = 'https://google.serper.dev/news';

// 新闻新鲜度：只保留 48 小时内的新闻
const FRESHNESS_HOURS = 48;

// 低质量/地方性关键词黑名单
const BLACKLIST_KEYWORDS = [
  // 地方性新闻
  '上海', '北京', '深圳', '广州', '杭州', '成都', '武汉', '西安',
  '南京', '重庆', '天津', '苏州', '长沙', '郑州', '宁波',
  '省份', '地市', '区县', '街道', '社区',
  // 招聘相关
  '招聘', '诚聘', '年薪', '月薪', '五险一金', '带薪休假',
  // 无关活动
  '年会', '团建', '聚餐', '生日会', '运动会',
  // 过度营销
  '限时', '抢购', '秒杀', '特价', '打折', '优惠券',
  // 标题党词汇（保留但降级）
  '震惊', '炸了', '爆火', '全网', '疯传'
];

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

/**
 * 检查新闻是否足够新鲜（48小时内）
 */
function isFreshNews(publishedAt) {
  if (!publishedAt) return true; // 没有时间默认保留
  
  const pubDate = new Date(publishedAt);
  const now = new Date();
  const diffHours = (now - pubDate) / (1000 * 60 * 60);
  
  return diffHours <= FRESHNESS_HOURS;
}

/**
 * 检查是否是低质量/地方性新闻
 */
function isLowQualityNews(title = '', snippet = '') {
  const text = (title + ' ' + snippet).toLowerCase();
  
  // 检查是否包含过多地方性关键词
  const localKeywords = ['上海', '北京', '深圳', '广州', '杭州', '成都', '武汉', '西安', '南京', '重庆'];
  const localCount = localKeywords.filter(kw => text.includes(kw.toLowerCase())).length;
  
  // 如果标题中包含 2 个及以上地名，可能是地方性新闻
  if (localCount >= 2) return true;
  
  // 检查其他黑名单关键词
  const otherBlacklist = ['招聘', '诚聘', '年薪', '月薪', '年会', '团建', '限时', '抢购', '秒杀'];
  if (otherBlacklist.some(kw => text.includes(kw.toLowerCase()))) return true;
  
  return false;
}

/**
 * 计算字符串相似度（编辑距离）
 */
function similarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // 计算共同子串长度
  let commonLength = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen && s1[i] === s2[i]; i++) {
    commonLength++;
  }
  
  return commonLength / Math.max(s1.length, s2.length);
}

/**
 * 检查文本是否包含 AI 关键词
 */
function containsAIKeywords(text = '') {
  const lowerText = text.toLowerCase();
  return AI_KEYWORDS.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * 解析 RSS Feed
 */
async function parseRSS(source) {
  try {
    console.log(`📡 正在抓取: ${source.name}`);
    const feed = await rssParser.parseURL(source.url);
    
    const items = feed.items
      .map(item => ({
        title: item.title || '',
        url: item.link || item.url || '',
        snippet: item.contentSnippet || item.summary || item.content || '',
        source: source.name,
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        region: source.region || (DOMESTIC_RSS_SOURCES.includes(source) ? '国内' : '海外')
      }))
      // 过滤新鲜度
      .filter(item => isFreshNews(item.publishedAt))
      // 过滤低质量新闻
      .filter(item => !isLowQualityNews(item.title, item.snippet))
      // 过滤 AI 相关新闻
      .filter(item => containsAIKeywords(item.title) || containsAIKeywords(item.snippet));
    
    console.log(`   ✓ 获取 ${items.length} 条有效新闻`);
    return items;
  } catch (error) {
    console.error(`   ✗ 抓取失败: ${error.message}`);
    return [];
  }
}

/**
 * 从 Serper API 获取海外新闻
 */
async function fetchSerperNews() {
  if (!CONFIG.serper.apiKey) {
    console.log('⚠️ 未配置 Serper API Key，跳过海外新闻搜索');
    return [];
  }
  
  try {
    console.log('📡 正在通过 Serper 搜索海外新闻...');
    
    const searchQueries = [
      'AI artificial intelligence news today',
      'OpenAI GPT ChatGPT news',
      'Google Gemini AI news',
      'Anthropic Claude AI news',
      'Meta AI Llama news',
      'Microsoft Copilot AI news',
      'NVIDIA AI chip news',
      'AI startup funding investment',
      'AI regulation policy',
      'generative AI news'
    ];
    
    const allNews = [];
    
    for (const query of searchQueries) {
      try {
        const response = await axios.post(SERPER_API_URL, {
          q: query,
          gl: 'us',
          hl: 'en',
          tbs: 'qdr:d',  // 过去 24 小时
          num: 10
        }, {
          headers: {
            'X-API-KEY': CONFIG.serper.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        
        const news = response.data.news || [];
        
        for (const item of news) {
          if (item.title && item.link) {
            const newsItem = {
              title: item.title,
              url: item.link,
              snippet: item.snippet || item.description || '',
              source: item.source || 'Serper',
              publishedAt: item.date || new Date().toISOString(),
              region: '海外'
            };
            
            // 检查新鲜度和质量
            if (isFreshNews(newsItem.publishedAt) && !isLowQualityNews(newsItem.title, newsItem.snippet)) {
              allNews.push(newsItem);
            }
          }
        }
      } catch (queryError) {
        // 静默处理 404（可能是 RSS 源暂时不可用）
        if (queryError.response?.status !== 404) {
          console.warn(`   ⚠️ 搜索 "${query}" 失败: ${queryError.message}`);
        }
      }
      
      // 避免 rate limit
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`   ✓ 获取 ${allNews.length} 条海外新闻`);
    return allNews;
  } catch (error) {
    console.error(`   ✗ Serper 搜索失败: ${error.message}`);
    return [];
  }
}

/**
 * 高级去重（基于 URL 和标题相似度）
 */
function advancedDeduplicate(items) {
  const result = [];
  const seenUrls = new Set();
  
  // 按时间排序（最新的优先）
  const sorted = [...items].sort((a, b) => 
    new Date(b.publishedAt) - new Date(a.publishedAt)
  );
  
  for (const item of sorted) {
    // URL 去重
    if (seenUrls.has(item.url)) continue;
    
    // 检查是否与已保留的标题过于相似
    let isDuplicate = false;
    for (const existing of result) {
      const sim = similarity(item.title, existing.title);
      if (sim > 0.7) { // 相似度超过 70% 认为是重复
        isDuplicate = true;
        console.log(`   🔄 去重: "${item.title.substring(0, 30)}..." 与 "${existing.title.substring(0, 30)}..."`);
        break;
      }
    }
    
    if (!isDuplicate) {
      seenUrls.add(item.url);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * 抓取所有新闻
 */
export async function fetchAllNews() {
  console.log('\n📰 开始抓取新闻...');
  console.log(`   新鲜度要求: ${FRESHNESS_HOURS}小时内\n`);
  
  // 抓取国内新闻
  const domesticPromises = DOMESTIC_RSS_SOURCES.map(source => 
    parseRSS({ ...source, region: '国内' })
  );
  
  // 抓取海外 RSS
  const overseasRssPromises = OVERSEAS_RSS_SOURCES.map(source => 
    parseRSS({ ...source, region: '海外' })
  );
  
  // 抓取政策监管新闻
  const policyPromises = POLICY_RSS_SOURCES.map(source => 
    parseRSS({ ...source, region: '海外' })
  );
  
  // 并行抓取
  const [domesticResults, overseasRssResults, policyResults, serperResults] = await Promise.all([
    Promise.all(domesticPromises),
    Promise.all(overseasRssPromises),
    Promise.all(policyPromises),
    fetchSerperNews()
  ]);
  
  // 合并结果
  const domesticRaw = domesticResults.flat();
  const overseasRaw = [...overseasRssResults.flat(), ...policyResults.flat(), ...serperResults];
  
  console.log(`\n📊 原始抓取:`);
  console.log(`   国内: ${domesticRaw.length} 条`);
  console.log(`   海外: ${overseasRaw.length} 条`);
  
  // 高级去重
  console.log('\n🔄 执行智能去重...');
  const uniqueDomestic = advancedDeduplicate(domesticRaw);
  const uniqueOverseas = advancedDeduplicate(overseasRaw);
  
  // 跨域去重（检查国内外是否有重复报道）
  const finalOverseas = uniqueOverseas.filter(item => {
    for (const dom of uniqueDomestic) {
      if (similarity(item.title, dom.title) > 0.6) {
        console.log(`   🌐 跨域去重: 海外 "${item.title.substring(0, 25)}..." 与国内重复`);
        return false;
      }
    }
    return true;
  });
  
  console.log(`\n📊 去重后:`);
  console.log(`   国内: ${uniqueDomestic.length} 条`);
  console.log(`   海外: ${finalOverseas.length} 条`);
  console.log(`   总计: ${uniqueDomestic.length + finalOverseas.length} 条\n`);
  
  return {
    domestic: uniqueDomestic,
    overseas: finalOverseas
  };
}
