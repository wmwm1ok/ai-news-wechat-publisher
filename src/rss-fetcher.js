import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, AI_KEYWORDS, CONFIG } from './config.js';

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
 * 从 GNews API 获取海外新闻
 */
async function fetchGNews() {
  if (!CONFIG.gnews.apiKey) {
    console.log('⚠️ 未配置 GNews API Key，跳过海外新闻抓取');
    return [];
  }
  
  try {
    console.log('📡 正在抓取 GNews...');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const response = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: 'AI OR "artificial intelligence" OR LLM OR "large language model"',
        lang: 'en',
        token: CONFIG.gnews.apiKey,
        max: 50,
        sortby: 'publishedAt',
        from: yesterday.toISOString(),
        to: new Date().toISOString()
      },
      timeout: 15000
    });
    
    const articles = response.data.articles || [];
    const mapped = articles.slice(0, 10).map(item => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.description || item.content || '',
      source: item.source?.name || 'GNews',
      publishedAt: item.publishedAt || new Date().toISOString(),
      region: '海外'
    }));
    
    console.log(`   ✓ 获取 ${mapped.length} 条海外新闻`);
    return mapped;
  } catch (error) {
    console.error(`   ✗ GNews 抓取失败: ${error.message}`);
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
    fetchGNews()
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
