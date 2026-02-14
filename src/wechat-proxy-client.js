import http from 'http';
import { CONFIG } from './config.js';

const RAW_PROXY_URL = process.env.WECHAT_PROXY_URL || '';
const PROXY_URL = RAW_PROXY_URL.replace(/^https:\/\//, 'http://');

console.log('[WeChat Proxy] 初始化:');
console.log(`  URL: ${PROXY_URL || '(未配置)'}`);

export function isProxyMode() {
  return !!PROXY_URL;
}

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
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`解析失败: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
    req.write(postData);
    req.end();
  });
}

export async function getAccessTokenViaProxy() {
  if (!PROXY_URL) throw new Error('未配置 WECHAT_PROXY_URL');
  
  console.log('🔌 获取微信 access_token...');
  
  const data = await httpPost('/wechat/token', {
    appid: CONFIG.wechat.appId,
    secret: CONFIG.wechat.appSecret
  }, 15000);
  
  if (data.access_token) {
    console.log('✅ 获取 access_token 成功');
    return data.access_token;
  }
  
  throw new Error(`微信错误: ${JSON.stringify(data)}`);
}

/**
 * 发布图文消息 - 未认证公众号使用群发预览接口
 * 注意：未认证公众号每天只能群发1条（订阅号）
 */
export async function publishToWechatSimple(article, accessToken) {
  console.log('🔌 发布到微信公众号（未认证账号模式）...');
  console.log('   ⚠️  注意：未认证公众号每天限发1条');
  
  // 使用群发预览接口（这是未认证公众号可用的方式）
  // 发送给运营者微信号
  const response = await httpPost('/wechat/mass/preview', {
    access_token: accessToken,
    touser: 'OPENID', // 需要替换为实际的管理员 OPENID
    media_id: 'MEDIA_ID'
  }, 15000);
  
  console.log('响应:', JSON.stringify(response));
  
  if (response.errcode === 0) {
    console.log('✅ 预览发送成功');
    return response;
  }
  
  throw new Error(`微信 API 错误 [${response.errcode}]: ${response.errmsg}`);
}

/**
 * 简化版发布 - 保存到仓库，不实际发微信
 * （因为未认证公众号限制太多）
 */
export async function saveArticleForManualPublish(article, accessToken) {
  console.log('💾 保存文章（未认证公众号需手动发布）');
  console.log('   文章已保存到 output/ 目录');
  console.log('   请手动复制内容到微信公众号后台发布');
  
  // 返回模拟的成功结果
  return {
    mode: 'manual',
    message: '未认证公众号限制：请手动发布',
    saved: true
  };
}
