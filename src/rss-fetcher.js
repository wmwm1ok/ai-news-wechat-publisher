import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, CONFIG } from './config.js';

const FRESHNESS_HOURS = 24;

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

function isFreshNews(publishedAt) {
  if (!publishedAt) return true;
  
  const pubDate = new Date(publishedAt);
  const now = new Date();
  const diffHours = (now - pubDate) / (1000 * 60 * 60);
  
  return diffHours <= FRESHNESS_HOURS;
}

async function parseRSS(source) {
  try {
    console.log(`📡 ${source.name}`);
    const feed = await rssParser.parseURL(source.url);
    
    const items = feed.items
      .map(item => ({
        title: item.title || '',
        url: item.link || item.url || '',
        snippet: item.contentSnippet || item.summary || item.content || '',
        source: source.name,
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        region: DOMESTIC_RSS_SOURCES.includes(source) ? '国内' : '海外'
      }))
      .filter(item => isFreshNews(item.publishedAt))
      .slice(0, source.limit || 5);
    
    console.log(`   ✓ ${items.length} 条`);
    return items;
  } catch (error) {
    console.error(`   ✗ 失败: ${error.message}`);
    return [];
  }
}

async function fetchSerperNews() {
  if (!CONFIG.serper.apiKey) {
    return [];
  }
  
  try {
    console.log('📡 Serper API');
    
    const queries = [
      'OpenAI GPT news today',
      'Google Gemini AI news',
      'Anthropic Claude AI news'
    ];
    
    const allNews = [];
    
    for (const query of queries) {
      try {
        const response = await axios.post('https://google.serper.dev/news', {
          q: query,
          gl: 'us',
          hl: 'en',
          tbs: 'qdr:d',
          num: 5
        }, {
          headers: {
            'X-API-KEY': CONFIG.serper.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        
        for (const item of response.data.news || []) {
          if (item.title && item.link) {
            allNews.push({
              title: item.title,
              url: item.link,
              snippet: item.snippet || '',
              source: item.source || 'Serper',
              publishedAt: item.date || new Date().toISOString(),
              region: '海外'
            });
          }
        }
      } catch (e) {}
      
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`   ✓ ${allNews.length} 条`);
    return allNews;
  } catch (error) {
    return [];
  }
}

function deduplicate(news) {
  const seen = new Set();
  const result = [];
  
  for (const item of news) {
    const key = item.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

export async function fetchAllNews() {
  console.log('📰 抓取新闻中...\n');
  
  const domestic = [];
  for (const source of DOMESTIC_RSS_SOURCES) {
    const items = await parseRSS(source);
    domestic.push(...items);
  }
  
  const overseas = [];
  for (const source of OVERSEAS_RSS_SOURCES) {
    const items = await parseRSS(source);
    overseas.push(...items);
  }
  
  const serperNews = await fetchSerperNews();
  overseas.push(...serperNews);
  
  const uniqueDomestic = deduplicate(domestic);
  const uniqueOverseas = deduplicate(overseas);
  
  console.log(`\n📊 去重后: 国内 ${uniqueDomestic.length}, 海外 ${uniqueOverseas.length}`);
  
  return {
    domestic: uniqueDomestic,
    overseas: uniqueOverseas
  };
}
