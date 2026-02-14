import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, AI_KEYWORDS, CONFIG } from './config.js';

// Serper API 配置
const SERPER_API_URL = 'https://google.serper.dev/news';

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

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
    
    const items = feed.items.slice(0, source.limit * 3).map(item => ({
      title: item.title || '',
      url: item.link || item.url || '',
      snippet: item.contentSnippet || item.summary || item.content || '',
      source: source.name,
      publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
      region: source.region || (DOMESTIC_RSS_SOURCES.includes(source) ? '国内' : '海外')
    }));
    
    // 过滤 AI 相关新闻
    const filtered = items.filter(item => 
      containsAIKeywords(item.title) || containsAIKeywords(item.snippet)
    ).slice(0, source.limit);
    
    console.log(`   ✓ 获取 ${filtered.length}/${items.length} 条 AI 相关新闻`);
    return filtered;
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
      'AI artificial intelligence news',
      'OpenAI GPT news',
      'Google Gemini AI news'
    ];
    
    const allNews = [];
    
    for (const query of searchQueries) {
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
      
      // 避免 rate limit
      await new Promise(r => setTimeout(r, 500));
    }
    
    // 去重
    const seen = new Set();
    const unique = allNews.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
    
    console.log(`   ✓ 获取 ${unique.length} 条海外新闻`);
    return unique.slice(0, 15);
  } catch (error) {
    console.error(`   ✗ Serper 搜索失败: ${error.message}`);
    if (error.response) {
      console.error(`   响应: ${JSON.stringify(error.response.data)}`);
    }
    return [];
  }
}

/**
 * 抓取所有新闻
 */
export async function fetchAllNews() {
  console.log('\n📰 开始抓取新闻...\n');
  
  // 抓取国内新闻
  const domesticPromises = DOMESTIC_RSS_SOURCES.map(source => 
    parseRSS({ ...source, region: '国内' })
  );
  
  // 抓取海外 RSS
  const overseasRssPromises = OVERSEAS_RSS_SOURCES.map(source => 
    parseRSS({ ...source, region: '海外' })
  );
  
  // 并行抓取
  const [domesticResults, overseasRssResults, gnewsResults] = await Promise.all([
    Promise.all(domesticPromises),
    Promise.all(overseasRssPromises),
    fetchSerperNews()
  ]);
  
  // 合并结果
  const domestic = domesticResults.flat();
  const overseas = [...overseasRssResults.flat(), ...gnewsResults];
  
  // 去重（基于 URL）
  const seenUrls = new Set();
  const uniqueDomestic = domestic.filter(item => {
    if (seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });
  
  const uniqueOverseas = overseas.filter(item => {
    if (seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });
  
  console.log(`\n📊 抓取结果:`);
  console.log(`   国内新闻: ${uniqueDomestic.length} 条`);
  console.log(`   海外新闻: ${uniqueOverseas.length} 条`);
  console.log(`   总计: ${uniqueDomestic.length + uniqueOverseas.length} 条\n`);
  
  return {
    domestic: uniqueDomestic,
    overseas: uniqueOverseas
  };
}
