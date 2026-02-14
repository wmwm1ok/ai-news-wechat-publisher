#!/usr/bin/env node

import { validateConfig } from './config.js';
import { fetchAllNews } from './rss-fetcher.js';
import { summarizeNews } from './ai-summarizer.js';
import { generateHTML, generateWechatHTML } from './html-formatter.js';
import { publishToWechat } from './wechat-publisher.js';
import { generateWechatEditorFormat } from './manual-publish-helper.js';
import { generateXiumiFormat } from './xiumi-formatter.js';
import fs from 'fs/promises';
import path from 'path';

// 解析命令行参数
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FETCH_ONLY = args.includes('--fetch-only');
const PUBLISH_ONLY = args.includes('--publish-only');
const SKIP_PUBLISH = args.includes('--skip-publish');

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
  console.log('🚀 AI 新闻自动抓取与发布系统');
  console.log('='.repeat(50) + '\n');
  
  // 调试：显示环境变量状态（隐藏敏感信息）
  console.log('🔧 环境变量检查:');
  console.log(`   DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`   WECHAT_APPID: ${process.env.WECHAT_APPID ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`   WECHAT_SECRET: ${process.env.WECHAT_SECRET ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`   WECHAT_PROXY_URL: ${process.env.WECHAT_PROXY_URL || '❌ 未设置'}`);
  console.log(`   SERPER_API_KEY: ${process.env.SERPER_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
  console.log('');
  
  // 验证配置
  validateConfig();
  
  let groupedNews = null;
  
  // 1. 抓取新闻
  if (!PUBLISH_ONLY) {
    const news = await fetchAllNews();
    
    if (news.domestic.length === 0 && news.overseas.length === 0) {
      console.error('❌ 没有获取到任何新闻，流程终止');
      process.exit(1);
    }
    
    // 2. AI 总结
    groupedNews = await summarizeNews(news);
    
    const totalNews = Object.values(groupedNews).flat().length;
    if (totalNews === 0) {
      console.error('❌ AI 总结后没有有效新闻，流程终止');
      process.exit(1);
    }
    
    // 保存原始数据
    await saveOutput(
      `news-${new Date().toISOString().split('T')[0]}.json`,
      JSON.stringify(groupedNews, null, 2)
    );
    
    // 生成 HTML
    const html = generateHTML(groupedNews);
    const wechatHtml = generateWechatHTML(groupedNews);
    
    await saveOutput(`newsletter-${new Date().toISOString().split('T')[0]}.html`, html);
    await saveOutput(`wechat-${new Date().toISOString().split('T')[0]}.html`, wechatHtml);
    
    console.log(`\n📊 共生成 ${totalNews} 条新闻摘要`);
    console.log('分类统计:');
    for (const [section, items] of Object.entries(groupedNews)) {
      if (items.length > 0) {
        console.log(`   ${section}: ${items.length} 条`);
      }
    }
    console.log('');
    
    if (FETCH_ONLY) {
      console.log('✅ 抓取模式完成，跳过发布');
      return;
    }
  } else {
    // 发布模式：读取已有数据
    console.log('📂 发布模式：读取已有数据...\n');
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await fs.readFile(`output/news-${today}.json`, 'utf-8');
      groupedNews = JSON.parse(data);
    } catch (error) {
      console.error('❌ 没有找到今天的新闻数据，请先运行抓取模式');
      process.exit(1);
    }
  }
  
  // 3. 发布到微信公众号
  if (!SKIP_PUBLISH && !DRY_RUN) {
    console.log('\n📤 即将发布到微信公众号...');
    console.log('   注意: 未认证公众号需要手动发布\n');
    const wechatHtml = generateWechatHTML(groupedNews);
    const date = new Date().toLocaleDateString('zh-CN');
    
    // 提取摘要（取前3条新闻的摘要）
    const allNews = Object.values(groupedNews).flat();
    const digest = allNews.slice(0, 3).map(n => n.title).join('；');
    
    try {
      // 尝试使用微信 API 发布
      const result = await publishToWechat({
        title: `AI 每日快报｜${date}`,
        content: wechatHtml,
        digest: digest.substring(0, 120),
        publishOnly: true,
        preview: false
      });
      
      console.log('\n✅ 发布完成！');
      console.log(`   模式: ${result.mode}`);
      if (result.mediaId) {
        console.log(`   Media ID: ${result.mediaId}`);
      }
      if (result.publishId) {
        console.log(`   Publish ID: ${result.publishId}`);
      }
      
      // 保存发布记录
      await saveOutput(
        `publish-${new Date().toISOString().split('T')[0]}.json`,
        JSON.stringify(result, null, 2)
      );
      
    } catch (error) {
      // 微信 API 失败，使用手动发布方案
      console.error('\n⚠️  微信 API 发布失败:', error.message);
      console.log('\n🔄 切换到手动发布模式（适用于未认证公众号）...\n');
      
      // 生成多种格式的发布文件
      const manualResult = await generateWechatEditorFormat(groupedNews);
      const xiumiResult = await generateXiumiFormat(groupedNews);
      
      console.log('\n✅ 已生成所有格式的发布文件！');
      console.log('');
      
      // 保存错误信息
      await saveOutput(
        `publish-error-${new Date().toISOString().split('T')[0]}.txt`,
        `错误: ${error.message}\n\n已生成发布文件:\n- 微信格式: ${manualResult.htmlPath}\n- 秀米格式: ${xiumiResult.xiumiPath}\n- 纯文本: ${manualResult.textPath}`
      );
    }
  } else if (DRY_RUN) {
    console.log('🧪 试运行模式：跳过实际发布');
    console.log('   生成的内容已保存到 output/ 目录');
  } else {
    console.log('⏭️ 跳过发布（使用 --skip-publish 或 --fetch-only）');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ 全部完成！');
  console.log('='.repeat(50) + '\n');
}

// 运行
main().catch(error => {
  console.error('\n❌ 程序出错:', error.message);
  if (process.env.DEBUG === 'true') {
    console.error(error.stack);
  }
  process.exit(1);
});
