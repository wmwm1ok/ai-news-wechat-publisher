#!/usr/bin/env node

import { fetchAllNews } from './rss-fetcher.js';
import { summarizeNews } from './ai-summarizer.js';
import { selectTopNews } from './news-scorer.js';
import { generateHTML, generateWechatHTML } from './html-formatter.js';
import fs from 'fs/promises';
import path from 'path';

async function saveOutput(filename, content) {
  const outputDir = 'output';
  await fs.mkdir(outputDir, { recursive: true });
  
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`💾 已保存: ${filepath}`);
  return filepath;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 AI 新闻智能筛选系统 (专业版)');
  console.log('='.repeat(60) + '\n');
  
  // 检查 API Key
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ 缺少 DEEPSEEK_API_KEY');
    process.exit(1);
  }
  
  console.log('🔧 环境检查: DEEPSEEK_API_KEY ✅\n');
  
  // 1. 抓取新闻
  const news = await fetchAllNews();
  
  if (news.domestic.length === 0 && news.overseas.length === 0) {
    console.error('❌ 没有获取到任何新闻');
    process.exit(1);
  }
  
  console.log(`\n📊 抓取完成: 国内 ${news.domestic.length} 条, 海外 ${news.overseas.length} 条`);
  
  // 2. AI 总结和分类
  const allNews = await summarizeNews(news);
  
  console.log(`\n📝 AI总结完成: ${allNews.length} 条新闻`);
  
  // 3. 质量评分和智能筛选
  console.log('\n🎯 开始质量评分...');
  const topNews = selectTopNews(allNews, 12);
  
  if (topNews.length === 0) {
    console.error('❌ 没有符合质量标准的新闻');
    process.exit(1);
  }
  
  // 4. 标准化分类并分组
  const standardCategories = ['产品发布与更新', '技术与研究', '投融资与并购', '政策与监管'];
  
  // 将非标准分类映射到标准分类
  for (const news of topNews) {
    if (!standardCategories.includes(news.category)) {
      // 根据关键词映射
      const t = news.title.toLowerCase();
      if (t.includes('发布') || t.includes('上线') || t.includes('推出')) {
        news.category = '产品发布与更新';
      } else if (t.includes('融资') || t.includes('投资') || t.includes('收购')) {
        news.category = '投融资与并购';
      } else if (t.includes('政策') || t.includes('监管') || t.includes('法规')) {
        news.category = '政策与监管';
      } else {
        news.category = '技术与研究';
      }
    }
  }
  
  const grouped = {};
  for (const section of standardCategories) {
    grouped[section] = topNews.filter(n => n.category === section);
  }
  
  const totalNews = topNews.length;
  
  // 5. 生成 HTML
  const html = generateHTML(grouped);
  const wechatHtml = generateWechatHTML(grouped);
  
  const date = new Date().toISOString().split('T')[0];
  await saveOutput(`newsletter-${date}.html`, html);
  await saveOutput(`wechat-${date}.html`, wechatHtml);
  
  // 6. 生成 JSON
  const jsonData = {
    date: new Date().toLocaleDateString('zh-CN'),
    count: totalNews,
    articles: topNews.map(item => ({
      section: item.category,
      title: item.title,
      company: item.company || '',
      source: item.source,
      publishedAt: item.publishedAt,
      summary: item.summary,
      score: item.score,
      matchedKeywords: item.matchedKeywords
    }))
  };
  await saveOutput('latest.json', JSON.stringify(jsonData, null, 2));
  await saveOutput(`news-${date}.json`, JSON.stringify(grouped, null, 2));
  
  // 7. 统计输出
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 最终输出统计');
  console.log('='.repeat(60));
  console.log(`总计: ${totalNews} 条高质量新闻`);
  console.log('\n分类分布:');
  for (const [section, items] of Object.entries(grouped)) {
    if (items.length > 0) {
      const domestic = items.filter(i => i.region === '国内').length;
      const overseas = items.filter(i => i.region === '海外').length;
      console.log(`   ${section}: ${items.length} 条 (🇨🇳${domestic}/🇺🇸${overseas})`);
    }
  }
  
  console.log('\n✅ 全部完成！');
  console.log('='.repeat(60) + '\n');
}

main().catch(error => {
  console.error('\n❌ 错误:', error.message);
  process.exit(1);
});
