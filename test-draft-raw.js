#!/usr/bin/env node

// 直接测试微信 draft/add API

import http from 'http';

const PROXY_URL = (process.env.WECHAT_PROXY_URL || '').replace(/^https:\/\//, 'http://');
const WECHAT_APPID = process.env.WECHAT_APPID;
const WECHAT_SECRET = process.env.WECHAT_SECRET;

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

async function main() {
  console.log('🧪 直接测试微信 API');
  console.log('==================');
  console.log(`Proxy: ${PROXY_URL}`);
  console.log(`AppID: ${WECHAT_APPID?.substring(0, 6)}...`);
  console.log('');
  
  try {
    // 1. 获取 token
    console.log('1️⃣ 获取 access_token...');
    const tokenRes = await httpPost('/wechat/token', {
      appid: WECHAT_APPID,
      secret: WECHAT_SECRET
    });
    console.log('响应:', JSON.stringify(tokenRes, null, 2));
    
    if (!tokenRes.access_token) {
      throw new Error('获取 token 失败');
    }
    
    const accessToken = tokenRes.access_token;
    console.log(`✅ 获取成功: ${accessToken.substring(0, 15)}...`);
    console.log('');
    
    // 2. 添加草稿
    console.log('2️⃣ 调用 draft/add...');
    const draftRes = await httpPost('/wechat/draft/add', {
      access_token: accessToken,
      articles: [{
        title: '测试文章 ' + Date.now(),
        author: '测试',
        digest: '测试摘要',
        content: '<p>测试内容</p>',
        content_source_url: '',
        thumb_media_id: '',
        need_open_comment: 1,
        only_fans_can_comment: 0
      }]
    });
    console.log('响应:', JSON.stringify(draftRes, null, 2));
    console.log('');
    
    if (!draftRes.media_id) {
      console.error('❌ draft/add 没有返回 media_id');
      console.error('可能的原因：');
      console.error('- 微信公众号没有草稿箱权限');
      console.error('- IP 白名单未配置');
      console.error('- 需要公众号认证');
      process.exit(1);
    }
    
    const mediaId = draftRes.media_id;
    console.log(`✅ 草稿创建成功, media_id: ${mediaId}`);
    console.log('');
    
    // 3. 尝试发布
    console.log('3️⃣ 调用 freepublish/submit...');
    const publishRes = await httpPost('/wechat/publish', {
      access_token: accessToken,
      media_id: mediaId,
      type: 'publish'
    });
    console.log('响应:', JSON.stringify(publishRes, null, 2));
    
    if (publishRes.errcode === 0) {
      console.log('✅ 发布成功！');
    } else {
      console.error(`❌ 发布失败: [${publishRes.errcode}] ${publishRes.errmsg}`);
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

main();
