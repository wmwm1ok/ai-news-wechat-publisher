import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, AI_KEYWORDS_CORE, AI_KEYWORDS_WEAK, CONFIG } from './config.js';

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

// 非AI新闻排除词（硬件评测、普通消费电子产品等）
const NON_AI_KEYWORDS = [
  // 显示设备
  'HDMI', '显示器', '显示屏', '屏幕', '电视', 'TV ', 'OLED', 'LCD', 'monitor',
  // 电脑硬件
  '笔记本', 'laptop', 'HP ', 'Dell', '华硕', '联想', '宏碁', 'MacBook',
  'CPU', '内存', '硬盘', 'SSD', '显卡', '主板', 'Intel', 'AMD',
  // 手机平板（非AI相关）
  'iPhone', 'iPad', '三星手机', '小米手机', '华为手机', 'OPPO', 'vivo',
  // 游戏
  '游戏', 'Game', 'Xbox', 'PlayStation', 'Nintendo', 'Switch',
  // 家电
  '冰箱', '洗衣机', '空调', '扫地机器人', '吸尘器',
  // 软件/服务（非AI）
  'tax', '税务', '报税', 'H&R Block', 'TurboTax', 'QuickBooks'
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
 * 检查文本是否与AI强相关
 * 策略：必须包含至少一个核心AI关键词，且不包含非AI关键词
 * 返回 true = 是AI新闻（保留），false = 非AI新闻（过滤）
 */
function isAIRelated(text = '') {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  
  // 首先检查是否包含明显非AI的关键词（如HDMI、电视、笔记本等）
  for (const keyword of NON_AI_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      console.log(`      🚫 非AI关键词 "${keyword}": ${text.substring(0, 40)}...`);
      return false; // 包含非AI关键词，过滤掉
    }
  }
  
  // 然后检查是否包含核心AI关键词
  for (const keyword of AI_KEYWORDS_CORE) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return true; // 是AI新闻，保留
    }
  }
  
  return false; // 没有AI关键词，过滤掉
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
      .filter(item => isAIRelated(item.title) || isAIRelated(item.snippet));
    
    console.log(`   ✓ 获取 ${items.length} 条有效新闻 (AI过滤后)`);
    
    // 调试：显示被过滤的非AI新闻
    if (items.length < feed.items.length) {
      const filteredOut = feed.items
        .map(item => item.title)
        .filter(title => !items.some(i => i.title === title));
      if (filteredOut.length > 0) {
        console.log(`   🚫 过滤掉 ${filteredOut.length} 条非AI新闻`);
      }
    }
    
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
            
            // 检查新鲜度、质量和AI相关性
            if (isFreshNews(newsItem.publishedAt) && 
                !isLowQualityNews(newsItem.title, newsItem.snippet) &&
                isAIRelated(newsItem.title)) {
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
  
  // 并行抓取
  const [domesticResults, overseasRssResults, serperResults] = await Promise.all([
    Promise.all(domesticPromises),
    Promise.all(overseasRssPromises),
    fetchSerperNews()
  ]);
  
  // 合并结果
  const domesticRaw = domesticResults.flat();
  const overseasRaw = [...overseasRssResults.flat(), ...serperResults];
  
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
