/**
 * Cloudflare Worker - 微信 API 代理 (Service Worker 格式)
 */

// CORS 配置
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

async function handleGetToken(request) {
  const { appid, secret } = await request.json();
  
  if (!appid || !secret) {
    return jsonResponse({ error: '缺少 appid 或 secret' }, 400);
  }
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`
  );
  
  const data = await response.json();
  return jsonResponse(data);
}

async function handleUploadNews(request) {
  const { access_token, articles } = await request.json();
  
  if (!access_token || !articles) {
    return jsonResponse({ error: '缺少 access_token 或 articles' }, 400);
  }
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/material/add_news?access_token=${access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles })
    }
  );
  
  const data = await response.json();
  return jsonResponse(data);
}

async function handlePublish(request) {
  const { access_token, media_id, type = 'publish' } = await request.json();
  
  if (!access_token || !media_id) {
    return jsonResponse({ error: '缺少 access_token 或 media_id' }, 400);
  }
  
  let apiUrl;
  let body;
  
  if (type === 'publish') {
    apiUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${access_token}`;
    body = { media_id };
  } else {
    apiUrl = `https://api.weixin.qq.com/cgi-bin/message/mass/sendall?access_token=${access_token}`;
    body = {
      filter: { is_to_all: true },
      mpnews: { media_id },
      msgtype: 'mpnews',
      send_ignore_reprint: 0
    };
  }
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return jsonResponse(data);
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  
  try {
    if (url.pathname === '/wechat/token') {
      return await handleGetToken(request);
    }
    
    if (url.pathname === '/wechat/uploadnews') {
      return await handleUploadNews(request);
    }
    
    if (url.pathname === '/wechat/publish') {
      return await handlePublish(request);
    }
    
    return jsonResponse({
      message: '微信 API 代理服务',
      endpoints: [
        'POST /wechat/token - 获取 access_token',
        'POST /wechat/uploadnews - 上传图文素材',
        'POST /wechat/publish - 发布图文消息'
      ]
    });
    
  } catch (error) {
    return jsonResponse({
      error: error.message,
      stack: error.stack
    }, 500);
  }
}
