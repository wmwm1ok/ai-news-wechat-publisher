# AI 新闻自动抓取与微信公众号发布系统

自动抓取 AI 行业资讯，使用 DeepSeek AI 进行总结分类，并发布到微信公众号。

## ✨ 功能特性

- 🤖 **自动抓取**：从多个 RSS 源抓取国内外 AI 新闻
- 🧠 **AI 总结**：使用 DeepSeek AI 自动总结和分类新闻
- 📱 **微信发布**：自动发布到微信公众号
- ⏰ **定时执行**：通过 GitHub Actions 每天自动运行
- 🏷️ **智能分类**：自动分为「产品发布」「技术研究」「投融资」「政策监管」四类

## 📁 项目结构

```
ai-news-wechat-publisher/
├── .github/
│   └── workflows/
│       └── daily-news.yml    # GitHub Actions 工作流
├── src/
│   ├── index.js              # 主入口
│   ├── config.js             # 配置文件
│   ├── rss-fetcher.js        # RSS 抓取模块
│   ├── ai-summarizer.js      # AI 总结模块
│   ├── html-formatter.js     # HTML 格式化模块
│   └── wechat-publisher.js   # 微信公众号发布模块
├── output/                   # 输出目录（自动生成）
├── .env.example              # 环境变量示例
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 创建 GitHub 仓库

```bash
# 在 GitHub 上创建新仓库，然后推送代码
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-news-wechat-publisher.git
git push -u origin main
```

### 2. 配置环境变量

在 GitHub 仓库设置中添加以下 Secrets：

| Secret Name | 说明 | 获取方式 |
|------------|------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | [DeepSeek 开放平台](https://platform.deepseek.com/) |
| `WECHAT_APPID` | 微信公众号 AppID | 微信公众平台 → 开发 → 基本配置 |
| `WECHAT_SECRET` | 微信公众号 AppSecret | 微信公众平台 → 开发 → 基本配置 |
| `GNEWS_API_KEY` | GNews API 密钥（可选）| [GNews](https://gnews.io/) |

配置步骤：
1. 打开 GitHub 仓库页面
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 逐个添加上面的 Secrets

### 3. 配置微信公众号

#### 3.1 获取 AppID 和 AppSecret
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「开发」→「基本配置」
3. 获取 AppID 和 AppSecret

#### 3.2 添加 IP 白名单（重要！）
1. 在「基本配置」→「IP 白名单」中添加 GitHub Actions 的出口 IP
2. 由于 GitHub Actions IP 是动态的，建议先运行一次查看日志中的错误 IP，然后添加

#### 3.3 开通图文消息接口
确保公众号已认证，且具有「群发接口」权限。

### 4. 运行测试

#### 本地测试
```bash
# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env
# 编辑 .env 填入你的配置

# 试运行（不实际发布）
npm run dry-run

# 只抓取新闻
npm run fetch

# 完整流程（本地发布）
npm start
```

#### GitHub Actions 手动触发
1. 进入 GitHub 仓库的 **Actions** 页面
2. 选择 **AI Daily News Publisher** 工作流
3. 点击 **Run workflow**
4. 可以勾选「试运行模式」进行测试

## ⚙️ 配置说明

### 修改 RSS 源

编辑 `src/config.js`：

```javascript
export const DOMESTIC_RSS_SOURCES = [
  { name: '36氪', url: 'https://36kr.com/feed', limit: 3 },
  { name: '机器之心', url: 'https://www.jiqizhixin.com/rss', limit: 2 },
  // 添加更多源...
];
```

### 修改定时时间

编辑 `.github/workflows/daily-news.yml`：

```yaml
on:
  schedule:
    # 每天早上 8:00 UTC+8
    - cron: '0 0 * * *'
```

Cron 格式说明：`分 时 日 月 星期`

### 修改发布模式

编辑 `src/index.js`：

```javascript
// 仅发布不推送（默认）
publishOnly: true

// 群发推送（会通知所有粉丝）
publishOnly: false

// 预览模式（发送给指定用户测试）
preview: true,
previewOpenid: '用户的openid'
```

## 📋 工作流程

```
定时触发 / 手动触发
    ↓
抓取 RSS 新闻 (36氪、机器之心、InfoQ、TechCrunch、GNews)
    ↓
AI 关键词过滤
    ↓
DeepSeek AI 总结和分类
    ↓
生成 HTML 内容
    ↓
上传到微信公众号素材库
    ↓
发布 / 群发推送
    ↓
保存输出文件到仓库
```

## 🔧 命令说明

```bash
# 完整流程：抓取 + 总结 + 发布
npm start

# 只抓取新闻，不发布
npm run fetch

# 试运行：抓取 + 总结，但不实际发布到微信
npm run dry-run

# 使用已有数据发布（跳过抓取）
npm run publish
```

## 🐛 常见问题

### 1. 微信发布失败 "IP 不在白名单"
- 在公众号后台添加 GitHub Actions 的出口 IP
- GitHub Actions 使用动态的 IP 范围，可以查看[官方文档](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners/ip-addresses)

### 2. DeepSeek API 调用失败
- 检查 `DEEPSEEK_API_KEY` 是否正确
- 查看 DeepSeek 账户余额是否充足

### 3. RSS 抓取失败
- 某些 RSS 源可能需要科学上网
- 检查 RSS URL 是否可访问

### 4. 发布成功但公众号看不到文章
- 检查发布模式：`publishOnly: true` 只会发布到公众号，不会推送给粉丝
- 在公众号后台「素材管理」→「图文消息」中查看

## 📄 License

MIT

## 🙏 致谢

- [DeepSeek](https://deepseek.com/) - AI 能力支持
- [GNews](https://gnews.io/) - 海外新闻 API
