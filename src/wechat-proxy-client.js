import axios from 'axios';
import https from 'https';
import { CONFIG } from './config.js';

const PROXY_URL = process.env.WECHAT_PROXY_URL;

// 创建 axios 实例，配置 TLS 选项
const createAxiosInstance = () => {
  return axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    }),
    headers: {
      'User-Agent': 'AI-News-Publisher/1.0'
    }
  });
};

/**
 * 检查是否使用代理模式
 */
export function isProxyMode() {
  return !!PROXY_URL;
}

/**
 * 获取微信 access_token（通过代理）
 */
export async function getAccessTokenViaProxy() {
  if (!isProxyMode()) {
    throw new Error('未配置 WECHAT_PROXY_URL');
  }
  
  console.log('🔌 使用 Cloudflare Worker 代理获取 access_token...');
  console.log(`   URL: ${PROXY_URL}/wechat/token`);
  
  const client = createAxiosInstance();
  
  try {
    const response = await client.post(`${PROXY_URL}/wechat/token`, {
      appid: CONFIG.wechat.appId,
      secret: CONFIG.wechat.appSecret
    });
    
    if (response.data.access_token) {
      console.log('✅ 通过代理获取 access_token 成功');
      return response.data.access_token;
    }
    
    throw new Error(`代理返回错误: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('❌ 代理获取 access_token 失败:', error.message);
    if (error.response) {
      console.error('   响应:', error.response.data);
    }
    throw error;
  }
}

/**
 * 上传图文素材（通过代理）
 */
export async function uploadNewsMaterialViaProxy(articles, accessToken) {
  console.log('🔌 使用 Cloudflare Worker 代理上传素材...');
  
  const client = createAxiosInstance();
  
  try {
    const response = await client.post(`${PROXY_URL}/wechat/uploadnews`, {
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
    }, {
      timeout: 30000
    });
    
    if (response.data.media_id) {
      console.log('✅ 通过代理上传素材成功');
      return response.data.media_id;
    }
    
    throw new Error(`代理返回错误: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('❌ 代理上传素材失败:', error.message);
    if (error.response) {
      console.error('   响应:', error.response.data);
    }
    throw error;
  }
}

/**
 * 发布图文消息（通过代理）
 */
export async function publishViaProxy(mediaId, accessToken, publishOnly = true) {
  console.log('🔌 使用 Cloudflare Worker 代理发布消息...');
  
  const client = createAxiosInstance();
  
  try {
    const response = await client.post(`${PROXY_URL}/wechat/publish`, {
      access_token: accessToken,
      media_id: mediaId,
      type: publishOnly ? 'publish' : 'mass'
    }, {
      timeout: 15000
    });
    
    if (response.data.errcode === 0) {
      console.log('✅ 通过代理发布成功');
      return response.data;
    }
    
    throw new Error(`代理返回错误: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('❌ 代理发布失败:', error.message);
    if (error.response) {
      console.error('   响应:', error.response.data);
    }
    throw error;
  }
}
