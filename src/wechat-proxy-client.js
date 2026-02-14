import http from 'http';
import { CONFIG } from './config.js';

// 安全读取环境变量
const RAW_PROXY_URL = process.env.WECHAT_PROXY_URL || '';
const PROXY_URL = RAW_PROXY_URL.replace(/^https:\/\//, 'http://');

/**
 * 检查是否使用代理模式
 */
export function isProxyMode() {
  return !!PROXY_URL;
}

/**
 * 使用 http 模块发送 POST 请求
 */
function httpPost(urlPath, data, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${PROXY_URL}${urlPath}`);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: 80,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeout
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`解析响应失败: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 获取微信 access_token（通过代理）
 */
export async function getAccessTokenViaProxy() {
  if (!PROXY_URL) {
    throw new Error('未配置 WECHAT_PROXY_URL');
  }
  
  console.log('🔌 使用 Cloudflare Worker 代理获取 access_token...');
  
  const data = await httpPost('/wechat/token', {
    appid: CONFIG.wechat.appId,
    secret: CONFIG.wechat.appSecret
  }, 15000);
  
  if (data.access_token) {
    console.log('✅ 通过代理获取 access_token 成功');
    return data.access_token;
  }
  
  throw new Error(`代理返回错误: ${JSON.stringify(data)}`);
}

/**
 * 上传图文素材（通过代理）- 使用新的草稿箱 API
 */
export async function uploadNewsMaterialViaProxy(articles, accessToken) {
  console.log('🔌 使用 Cloudflare Worker 代理添加草稿...');
  console.log(`   文章数量: ${articles.length}`);
  console.log(`   第一篇文章标题: ${articles[0]?.title?.substring(0, 30)}...`);
  
  const payload = {
    access_token: accessToken,
    articles: articles.map(article => ({
      title: article.title,
      author: article.author || 'AI日报',
      digest: article.digest || '',
      content: article.content,
      content_source_url: article.contentSourceUrl || '',
      thumb_media_id: article.thumbMediaId || '',
      need_open_comment: article.needOpenComment ?? 1,
      only_fans_can_comment: article.onlyFansCanComment ?? 0
    }))
  };
  
  console.log('   发送请求到 /wechat/draft/add...');
  const data = await httpPost('/wechat/draft/add', payload, 60000);
  
  console.log(`   响应: ${JSON.stringify(data)}`);
  
  // 草稿 API 返回 media_id
  if (data.media_id) {
    console.log(`✅ 通过代理添加草稿成功, media_id: ${data.media_id}`);
    return data.media_id;
  }
  
  // 如果有错误，显示详细信息
  if (data.errcode) {
    throw new Error(`微信 API 错误 [${data.errcode}]: ${data.errmsg}`);
  }
  
  throw new Error(`代理返回错误: ${JSON.stringify(data)}`);
}

/**
 * 发布图文消息（通过代理）
 */
export async function publishViaProxy(mediaId, accessToken, publishOnly = true) {
  console.log('🔌 使用 Cloudflare Worker 代理发布草稿...');
  console.log(`   media_id: ${mediaId}`);
  console.log(`   发布类型: ${publishOnly ? '发布到公众号(不推送)' : '群发推送'}`);
  
  const data = await httpPost('/wechat/publish', {
    access_token: accessToken,
    media_id: mediaId,
    type: publishOnly ? 'publish' : 'mass'
  }, 15000);
  
  console.log(`   响应: ${JSON.stringify(data)}`);
  
  if (data.errcode === 0) {
    console.log('✅ 通过代理发布成功');
    return data;
  }
  
  if (data.errcode) {
    throw new Error(`微信 API 错误 [${data.errcode}]: ${data.errmsg}`);
  }
  
  throw new Error(`代理返回错误: ${JSON.stringify(data)}`);
}
