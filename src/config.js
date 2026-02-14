import dotenv from 'dotenv';
dotenv.config();

// AI 关键词（用于过滤）
export const AI_KEYWORDS = [
  'AI', '人工智能', '大模型', '模型', '算法', '算力',
  '自动驾驶', '智能', '机器学习', '深度学习',
  '芯片', '半导体', '计算', '机器人', 'AGI',
  '多模态', '生成式', '推理', '端到端', '具身',
  'LLM', 'AIGC', 'GPT', 'OpenAI', 'Claude', 'Gemini', 'Sora',
  '智谱', '通义', '文心', 'Kimi', 'MiniMax', '百川', '讯飞星火', '混元',
  'Agent', '智能体', 'GPU', 'NVIDIA', '英伟达'
];

// 国内 RSS 源（专注于AI/科技）
export const DOMESTIC_RSS_SOURCES = [
  {
    name: '机器之心',
    url: 'https://www.jiqizhixin.com/rss',
    limit: 5
  },
  {
    name: '量子位',
    url: 'https://www.qbitai.com/feed',
    limit: 5
  },
  {
    name: '36氪',
    url: 'https://36kr.com/feed',
    limit: 4
  },
  {
    name: 'InfoQ',
    url: 'https://www.infoq.cn/feed',
    limit: 3
  },
  {
    name: '雷锋网',
    url: 'https://www.leiphone.com/feed',
    limit: 3
  },
  {
    name: 'AI科技评论',
    url: 'https://www.leiphone.com/category/ai/feed',
    limit: 3
  }
];

// 海外 RSS 源
export const OVERSEAS_RSS_SOURCES = [
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    limit: 5
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    limit: 4
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    limit: 4
  },
  {
    name: 'Wired AI',
    url: 'https://www.wired.com/tag/artificial-intelligence/feed/',
    limit: 3
  },
  {
    name: 'Ars Technica AI',
    url: 'https://arstechnica.com/tag/artificial-intelligence/feed/',
    limit: 3
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    limit: 3
  },
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    limit: 2
  },
  {
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/feeds/posts/default',
    limit: 2
  },
  {
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/rss.xml',
    limit: 2
  }
];

// 分类配置
export const SECTION_ORDER = [
  '产品发布与更新',
  '技术与研究',
  '投融资与并购',
  '政策与监管'
];

export const SECTION_ICON = {
  '产品发布与更新': '🚀',
  '技术与研究': '🧠',
  '投融资与并购': '💰',
  '政策与监管': '🏛️'
};

// API 配置
export const CONFIG = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  },
  wechat: {
    appId: process.env.WECHAT_APPID,
    appSecret: process.env.WECHAT_SECRET
  },
  serper: {
    apiKey: process.env.SERPER_API_KEY
  },
  debug: process.env.DEBUG === 'true'
};

// 验证配置
export function validateConfig() {
  const required = [
    ['DEEPSEEK_API_KEY', CONFIG.deepseek.apiKey],
    ['WECHAT_APPID', CONFIG.wechat.appId],
    ['WECHAT_SECRET', CONFIG.wechat.appSecret]
  ];
  
  const missing = required.filter(([name, value]) => !value);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的环境变量:');
    missing.forEach(([name]) => console.error(`   - ${name}`));
    console.error('\n请复制 .env.example 为 .env 并填写相应配置');
    process.exit(1);
  }
  
  console.log('✅ 配置验证通过');
}
