import fetch from 'node-fetch';
import { CONFIG } from './config.js';

const PROXY_URL = process.env.WECHAT_PROXY_URL;

/**
 * 检查是否使用代理模式
 */
export function isProxyMode() {
  return !!PROXY_URL;
}

/**
 * 发送请求（使用 node-fetch）
 */
async function proxyFetch(path, body, timeout = 30000) {
  const url = `${PROXY_URL}${path}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
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
  
  try {
    const data = await proxyFetch('/wechat/token', {
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
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}

/**
 * 上传图文素材（通过代理）
 */
export async function uploadNewsMaterialViaProxy(articles, accessToken) {
  console.log('🔌 使用 Cloudflare Worker 代理上传素材...');
  
  try {
    const data = await proxyFetch('/wechat/uploadnews', {
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
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}

/**
 * 发布图文消息（通过代理）
 */
export async function publishViaProxy(mediaId, accessToken, publishOnly = true) {
  console.log('🔌 使用 Cloudflare Worker 代理发布消息...');
  
  try {
    const data = await proxyFetch('/wechat/publish', {
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
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}
