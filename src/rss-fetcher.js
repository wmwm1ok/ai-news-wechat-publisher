import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, AI_KEYWORDS_CORE, CONFIG } from './config.js';

// Serper API 配置
const SERPER_API_URL = 'https://google.serper.dev/news';

// 新闻新鲜度：只保留 48 小时内的新闻
const FRESHNESS_HOURS = 48;

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
  if (!publishedAt) return true;
  
  const pubDate = new Date(publishedAt);
  const now = new Date();
  const diffHours = (now - pubDate) / (1000 * 60 * 60);
  
  return diffHours <= FRESHNESS_HOURS;
}

/**
 * 检查是否是AI相关新闻
 * 简单策略：标题必须包含核心AI关键词
 */
function isAIRelated(title = '') {
  if (!title) return false;
  const lowerTitle = title.toLowerCase();
  
  // 简单的关键词匹配
  return AI_KEYWORDS_CORE.some(keyword => 
    lowerTitle.includes(keyword.toLowerCase())
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
      .filter(item => isFreshNews(item.publishedAt))
      .filter(item => isAIRelated(item.title));
    
    console.log(`   ✓ 获取 ${items.length}/${feed.items.length} 条AI相关新闻`);
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
      'Anthropic Claude AI news'
    ];
    
    const allNews = [];
    
    for (const query of searchQueries) {
      try {
        const response = await axios.post(SERPER_API_URL, {
          q: query,
          gl: 'us',
          hl: 'en',
          tbs: 'qdr:d',
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
          if (item.title && item.link && isAIRelated(item.title)) {
            allNews.push({
              title: item.title,
              url: item.link,
              snippet: item.snippet || item.description || '',
              source: item.source || 'Serper',
              publishedAt: item.date || new Date().toISOString(),
              region: '海外'
            });
          }
        }
      } catch (error) {
        // 忽略错误
      }
      
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`   ✓ 获取 ${allNews.length} 条海外新闻`);
    return allNews;
  } catch (error) {
    console.error('Serper API 调用失败:', error.message);
    return [];
  }
}

/**
 * 执行智能去重
 */
function deduplicateNews(news) {
  const seen = new Map();
  const duplicates = [];
  
  for (const item of news) {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) {
      duplicates.push(item);
    } else {
      seen.set(key, item);
    }
  }
  
  for (const dup of duplicates) {
    console.log(`   🔄 去重: "${dup.title.substring(0, 50)}..."`);
  }
  
  return Array.from(seen.values());
}

/**
 * 抓取所有新闻
 */
export async function fetchAllNews() {
  console.log('\n📰 开始抓取新闻...');
  console.log(`   新鲜度要求: ${FRESHNESS_HOURS}小时内\n`);
  
  // 国内 RSS
  const domesticNews = [];
  for (const source of DOMESTIC_RSS_SOURCES) {
    const items = await parseRSS(source);
    domesticNews.push(...items);
  }
  
  // 海外 RSS
  const overseasNews = [];
  for (const source of OVERSEAS_RSS_SOURCES) {
    const items = await parseRSS(source);
    overseasNews.push(...items);
  }
  
  // Serper API
  const serperNews = await fetchSerperNews();
  overseasNews.push(...serperNews);
  
  console.log(`\n📊 原始抓取:`);
  console.log(`   国内: ${domesticNews.length} 条`);
  console.log(`   海外: ${overseasNews.length} 条`);
  
  // 去重
  console.log(`\n🔄 执行智能去重...`);
  const uniqueDomestic = deduplicateNews(domesticNews);
  const uniqueOverseas = deduplicateNews(overseasNews);
  
  console.log(`\n📊 去重后:`);
  console.log(`   国内: ${uniqueDomestic.length} 条`);
  console.log(`   海外: ${uniqueOverseas.length} 条`);
  console.log(`   总计: ${uniqueDomestic.length + uniqueOverseas.length} 条`);
  
  return {
    domestic: uniqueDomestic,
    overseas: uniqueOverseas
  };
}
