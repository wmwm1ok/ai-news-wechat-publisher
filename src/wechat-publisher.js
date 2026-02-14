import axios from 'axios';
import { CONFIG } from './config.js';
import { 
  isProxyMode, 
  getAccessTokenViaProxy
} from './wechat-proxy-client.js';

const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';
const PROXY_URL = process.env.WECHAT_PROXY_URL;

/**
 * 获取当前出口 IP
 */
async function getCurrentIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    return response.data.ip;
  } catch {
    return '未知';
  }
}

/**
 * 获取微信 access_token
 */
async function getAccessToken() {
  try {
    const response = await axios.get(`${WECHAT_API_BASE}/token`, {
      params: {
        grant_type: 'client_credential',
        appid: CONFIG.wechat.appId,
        secret: CONFIG.wechat.appSecret
      }
    });
    
    if (response.data.access_token) {
      return response.data.access_token;
    }
    
    throw new Error(`获取 access_token 失败: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('❌ 获取微信 access_token 失败');
    console.error('   错误信息:', error.message);
    
    if (error.response) {
      console.error('   微信 API 响应:', JSON.stringify(error.response.data));
      
      // 检查是否是 IP 白名单问题
      if (error.response.data?.errmsg?.includes('not in whitelist')) {
        const currentIP = await getCurrentIP();
        console.error('\n⚠️  ============================================');
        console.error('⚠️   重要提示: 当前 IP 不在微信公众号白名单中！');
        console.error('⚠️  ============================================');
        console.error(`\n📍 当前出口 IP: ${currentIP}`);
        console.error('\n👉 请将此 IP 添加到微信公众号后台的白名单：');
        console.error('   操作路径: 微信公众平台 → 开发 → 基本配置 → IP 白名单');
        console.error('\n💡 提示: 如果添加后仍然失败，可能是 IP 变化了，需要重新获取。');
        console.error('   考虑使用固定的代理服务器来避免此问题。\n');
      }
    }
    
    throw error;
  }
}

/**
 * 上传图文消息内的图片获取URL
 * （用于在文章内容中插入图片）
 */
export async function uploadContentImage(imagePathOrUrl, accessToken) {
  try {
    // 如果是网络图片，先下载
    let imageBuffer;
    if (imagePathOrUrl.startsWith('http')) {
      const response = await axios.get(imagePathOrUrl, {
        responseType: 'arraybuffer'
      });
      imageBuffer = Buffer.from(response.data);
    } else {
      // 本地文件
      const fs = await import('fs');
      imageBuffer = fs.readFileSync(imagePathOrUrl);
    }
    
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('media', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });
    
    const response = await axios.post(
      `${WECHAT_API_BASE}/media/uploadimg?access_token=${accessToken}`,
      form,
      {
        headers: form.getHeaders()
      }
    );
    
    if (response.data.url) {
      return response.data.url;
    }
    
    throw new Error(`上传图片失败: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('上传图片失败:', error.message);
    // 返回空，不影响主流程
    return null;
  }
}

/**
 * 上传图文消息素材
 */
async function uploadNewsMaterial(articles, accessToken) {
  try {
    const response = await axios.post(
      `${WECHAT_API_BASE}/material/add_news?access_token=${accessToken}`,
      {
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
      }
    );
    
    if (response.data.media_id) {
      return response.data.media_id;
    }
    
    throw new Error(`上传素材失败: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('上传图文素材失败:', error.message);
    if (error.response) {
      console.error('响应:', error.response.data);
    }
    throw error;
  }
}

/**
 * 预览图文消息（发送给指定用户预览）
 */
async function previewNews(mediaId, openid, accessToken) {
  try {
    const response = await axios.post(
      `${WECHAT_API_BASE}/message/mass/preview?access_token=${accessToken}`,
      {
        touser: openid,
        mpnews: {
          media_id: mediaId
        },
        msgtype: 'mpnews'
      }
    );
    
    if (response.data.errcode === 0) {
      console.log('✅ 预览消息发送成功');
      return true;
    }
    
    throw new Error(`预览发送失败: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('发送预览失败:', error.message);
    throw error;
  }
}

/**
 * 群发图文消息（正式发送给所有粉丝）
 */
async function massSendNews(mediaId, accessToken, isToAll = true) {
  try {
    const response = await axios.post(
      `${WECHAT_API_BASE}/message/mass/sendall?access_token=${accessToken}`,
      {
        filter: {
          is_to_all: isToAll
        },
        mpnews: {
          media_id: mediaId
        },
        msgtype: 'mpnews',
        send_ignore_reprint: 0
      }
    );
    
    if (response.data.errcode === 0) {
      console.log('✅ 群发消息发送成功');
      console.log(`   消息 ID: ${response.data.msg_id}`);
      return response.data.msg_id;
    }
    
    throw new Error(`群发失败: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('群发消息失败:', error.message);
    throw error;
  }
}

/**
 * 发布图文消息（发布到公众号，但不推送给粉丝）
 */
async function publishNews(mediaId, accessToken) {
  try {
    const response = await axios.post(
      `${WECHAT_API_BASE}/freepublish/submit?access_token=${accessToken}`,
      {
        media_id: mediaId
      }
    );
    
    if (response.data.errcode === 0) {
      console.log('✅ 发布成功（已发布到公众号，未推送）');
      console.log(`   发布 ID: ${response.data.publish_id}`);
      return response.data.publish_id;
    }
    
    throw new Error(`发布失败: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('发布消息失败:', error.message);
    throw error;
  }
}

/**
 * 发布文章到微信公众号
 * @param {Object} options
 * @param {string} options.title - 文章标题
 * @param {string} options.content - 文章内容（HTML）
 * @param {string} options.digest - 摘要
 * @param {string} options.thumbMediaId - 封面图片素材ID（可选）
 * @param {boolean} options.publishOnly - 仅发布不推送
 * @param {boolean} options.preview - 是否预览模式
 * @param {string} options.previewOpenid - 预览用户openid
 */
export async function publishToWechat({
  title,
  content,
  digest = '',
  thumbMediaId = '',
  publishOnly = false,
  preview = false,
  previewOpenid = ''
}) {
  console.log('\n📤 开始发布到微信公众号...\n');
  
  // 检测是否使用代理模式
  const useProxy = isProxyMode();
  if (useProxy) {
    console.log(`🔌 使用 Cloudflare Worker 代理: ${PROXY_URL}`);
    console.log('   这可以解决 GitHub Actions IP 变化导致的白名单问题\n');
  }
  
  // 1. 获取 access_token
  console.log('1️⃣ 获取微信 access_token...');
  const accessToken = useProxy 
    ? await getAccessTokenViaProxy()
    : await getAccessToken();
  console.log('   ✓ 获取成功\n');
  
  // 2. 准备文章
  console.log('2️⃣ 准备图文消息...');
  const article = {
    title: title,
    content: content,
    digest: digest,
    thumbMediaId: thumbMediaId,
    author: 'AI日报',
    showCoverPic: 0,
    needOpenComment: 1,
    onlyFansCanComment: 0
  };
  
  // 3. 上传素材
  console.log('3️⃣ 上传图文素材...');
  
  // 如果使用代理但公众号未认证，会失败，让外层捕获
  if (useProxy) {
    throw new Error('PROXY_MODE_NOT_SUPPORTED_FOR_UNAUTH');
  }
  
  const mediaId = await uploadNewsMaterial([article], accessToken);
  console.log(`   ✓ 素材上传成功，media_id: ${mediaId}\n`);
  
  // 4. 发送/发布
  console.log('4️⃣ 执行发布...');
  
  if (preview) {
    // 预览模式
    if (!previewOpenid) {
      throw new Error('预览模式需要提供 previewOpenid');
    }
    await previewNews(mediaId, previewOpenid, accessToken);
    return { mode: 'preview', mediaId, useProxy };
  } else if (publishOnly) {
    // 仅发布不推送
    const publishId = await publishNews(mediaId, accessToken);
    return { mode: 'publish', mediaId, publishId, useProxy };
  } else {
    // 群发推送
    const msgId = await massSendNews(mediaId, accessToken, true);
    return { mode: 'mass', mediaId, msgId, useProxy };
  }
}

/**
 * 检查发布状态
 */
export async function checkPublishStatus(publishId) {
  try {
    const accessToken = await getAccessToken();
    
    const response = await axios.post(
      `${WECHAT_API_BASE}/freepublish/get?access_token=${accessToken}`,
      {
        publish_id: publishId
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('检查发布状态失败:', error.message);
    throw error;
  }
}
