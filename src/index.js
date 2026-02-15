#!/usr/bin/env node

import { fetchAllNews } from './rss-fetcher.js';
import { summarizeNews } from './ai-summarizer.js';
import { generateHTML, generateWechatHTML } from './html-formatter.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 保存文件
 */
async function saveOutput(filename, content) {
  const outputDir = 'output';
  await fs.mkdir(outputDir, { recursive: true });
  
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`💾 已保存: ${filepath}`);
  return filepath;
}

/**
 * 主流程
 */
async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 AI 新闻自动抓取系统');
  console.log('='.repeat(50) + '\n');
  
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
  
  // 2. AI 总结
  const groupedNews = await summarizeNews(news);
  
  const totalNews = Object.values(groupedNews).flat().length;
  if (totalNews === 0) {
    console.error('❌ 没有生成有效新闻');
    process.exit(1);
  }
  
  // 3. 生成 HTML
  const html = generateHTML(groupedNews);
  const wechatHtml = generateWechatHTML(groupedNews);
  
  const date = new Date().toISOString().split('T')[0];
  await saveOutput(`newsletter-${date}.html`, html);
  await saveOutput(`wechat-${date}.html`, wechatHtml);
  
  // 4. 生成 JSON 供在线编辑器使用
  const jsonData = {
    date: new Date().toLocaleDateString('zh-CN'),
    count: totalNews,
    articles: Object.values(groupedNews).flat().map(item => ({
      section: item.category,
      title: item.title,
      company: item.company || '',
      source: item.source,
      publishedAt: item.publishedAt,
      summary: item.summary
    }))
  };
  await saveOutput('latest.json', JSON.stringify(jsonData, null, 2));
  await saveOutput(`news-${date}.json`, JSON.stringify(groupedNews, null, 2));
  
  // 5. 统计输出
  console.log(`\n📊 生成完成: ${totalNews} 条新闻`);
  console.log('分类统计:');
  for (const [section, items] of Object.entries(groupedNews)) {
    if (items.length > 0) {
      const domestic = items.filter(i => i.region === '国内').length;
      const overseas = items.filter(i => i.region === '海外').length;
      console.log(`   ${section}: ${items.length} 条 (🇨🇳${domestic} / 🇺🇸${overseas})`);
    }
  }
  
  console.log('\n✅ 全部完成！');
  console.log('='.repeat(50) + '\n');
}

// 运行
main().catch(error => {
  console.error('\n❌ 错误:', error.message);
  process.exit(1);
});
