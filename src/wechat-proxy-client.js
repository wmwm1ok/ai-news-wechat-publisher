import http from 'http';
import { CONFIG } from './config.js';

// 安全读取环境变量
const RAW_PROXY_URL = process.env.WECHAT_PROXY_URL || '';
const PROXY_URL = RAW_PROXY_URL.replace(/^https:\/\//, 'http://');

console.log('🔧 [wechat-proxy-client] 初始化:');
console.log(`   RAW_PROXY_URL: ${RAW_PROXY_URL || '(空)'}`);
console.log(`   PROXY_URL: ${PROXY_URL || '(空)'}`);
console.log(`   isProxyMode: ${!!PROXY_URL}`);

/**
 * 检查是否使用代理模式
 */
export function isProxyMode() {
  const mode = !!PROXY_URL;
  console.log(`   [isProxyMode] 返回: ${mode}`);
  return mode;
}

/**
 * 使用 http 模块发送 POST 请求（Worker 使用 HTTP，到微信使用 HTTPS）
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
  console.log(`   URL: ${PROXY_URL}/wechat/token`);
  
  try {
    const data = await httpPost('/wechat/token', {
      appid: CONFIG.wechat.appId,
      secret: CONFIG.wechat.appSecret
    }, 15000);
    
    if (data.access_token) {
      console.log('✅ 通过代理获取 access_token 成功');
      return data.access_token;
    }
    
    throw new Error(`代理返回错误: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('❌ 代理获取 access_token 失败:', error.message);
    throw error;
  }
}

/**
 * 上传图文素材（通过代理）
 */
export async function uploadNewsMaterialViaProxy(articles, accessToken) {
  console.log('🔌 使用 Cloudflare Worker 代理上传素材...');
  
  try {
    const data = await httpPost('/wechat/uploadnews', {
      access_token: accessToken,
      articles: articles.map(article => ({
        title: article.title,
        thumb_media_id: article.thumbMediaId || '',
        author: article.author || 'AI日报',
        digest: article.digest || '',
        show_cover_pic: article.showCoverPic ?? 0,
        content: article.content,
        content_source_url: article.contentSourceUrl || '',
        need_open_comment: article.needOpenComment ?? 0,
        only_fans_can_comment: article.onlyFansCanComment ?? 0
      }))
    }, 60000);
    
    if (data.media_id) {
      console.log('✅ 通过代理上传素材成功');
      return data.media_id;
    }
    
    throw new Error(`代理返回错误: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('❌ 代理上传素材失败:', error.message);
    throw error;
  }
}

/**
 * 发布图文消息（通过代理）
 */
export async function publishViaProxy(mediaId, accessToken, publishOnly = true) {
  console.log('🔌 使用 Cloudflare Worker 代理发布消息...');
  
  try {
    const data = await httpPost('/wechat/publish', {
      access_token: accessToken,
      media_id: mediaId,
      type: publishOnly ? 'publish' : 'mass'
    }, 15000);
    
    if (data.errcode === 0) {
      console.log('✅ 通过代理发布成功');
      return data;
    }
    
    throw new Error(`代理返回错误: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('❌ 代理发布失败:', error.message);
    throw error;
  }
}
