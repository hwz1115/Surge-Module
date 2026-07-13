/*
 * 69云自动签到 (Surge JS 版)
 * 移植自: https://github.com/Elykia093/69Yun_Auto_Checkin (Python + GitHub Actions)
 * Version: 2026-07-13 v1.0 (首次转换)
 *
 * 变更说明:
 *   - 原脚本用 requests + BeautifulSoup 登录/签到/解析用户信息, GitHub Actions 定时触发, Secrets 存账号密码。
 *   - Surge 版改用 $httpClient 做登录/签到请求, Cookie 从 Set-Cookie 手动拼装 (Surge 无 requests 的 cookiejar)。
 *   - 用户信息页解析: 原来用 BeautifulSoup 找 <script> 标签再正则; Surge 版直接对整页 HTML 做正则匹配
 *     window.ChatraIntegration 所在的 <script>...</script> 片段, 再从中提取 Class_Expire / Unused_Traffic。
 *   - 通知: 默认用 Surge $notification 本地推送; 若在 BoxJS 配置了 yun69_bot_token + yun69_chat_id,
 *     则额外发送 Telegram (格式与原脚本一致)。
 *   - 多账号: 原来用 USER1/PASS1, USER2/PASS2... 环境变量; Surge 版改成 BoxJS 存一个 JSON 数组,更好维护。
 *
 * BoxJS 配置项:
 *   yun69_accounts  : JSON 数组字符串, 例如:
 *                      [{"user":"a@x.com","pass":"123456"},{"user":"b@x.com","pass":"abcdef"}]
 *   yun69_bot_token : Telegram Bot Token (可选,不填则只发 Surge 通知)
 *   yun69_chat_id   : Telegram Chat ID (可选)
 *
 * Surge [Script] 配置示例:
 *   69云签到 = type=cron,cronexp="0 20 * * *",wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/hwz1115/Surge-Module/main/JS/yun69_checkin.js
 *   (cronexp 是 "0 20 * * *" 对应北京时间 04:00, 如需 08:00 改成 "0 0 * * *"; 记得整段带双引号)
 */

const domain = 'https://69yun69.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36';

let accounts = [];
try {
  accounts = JSON.parse($persistentStore.read('yun69_accounts') || '[]');
} catch (e) {
  console.log('⚠️ yun69_accounts 解析失败: ' + e);
}
const botToken = $persistentStore.read('yun69_bot_token') || '';
const chatId = $persistentStore.read('yun69_chat_id') || '';

;(async () => {
  console.log(`🔸 读取到账号数: ${accounts.length}`);
  if (!accounts.length) {
    console.log('❌ 未配置账号 (yun69_accounts)');
    $notification.post('69云签到', '', '❌ 未配置账号,请检查 BoxJS 中 yun69_accounts');
    $done();
    return;
  }

  const results = [];
  for (const acc of accounts) {
    results.push(await checkinOne(acc));
  }

  const summary = results.join('\n———\n');
  $notification.post('69云签到完成', '', summary.replace(/<[^>]+>/g, ''));

  if (botToken && chatId) {
    await sendTelegram(summary);
  }

  $done();
})().catch((e) => {
  console.log('❌ 脚本异常: ' + e);
  $notification.post('69云签到', '', '脚本异常: ' + e);
  $done();
});

function httpRequest(opts) {
  return new Promise((resolve, reject) => {
    $httpClient[opts.method || 'get'](opts, (err, resp, body) => {
      if (err) reject(err);
      else resolve({ resp, body });
    });
  });
}

function extractCookies(resp) {
  let raw = resp.headers['Set-Cookie'] || resp.headers['set-cookie'];
  if (!raw) return '';
  let parts;
  if (Array.isArray(raw)) {
    parts = raw;
  } else {
    // 有些环境会把多条 Set-Cookie 合并成一整个逗号分隔的字符串返回,
    // 直接按逗号切会把 Expires=Thu, 01-Jan... 里的逗号也切碎,
    // 所以只在"逗号后紧跟 名字=" 的位置切分,识别下一条 cookie 的开始。
    parts = raw.split(/,(?=\s*[a-zA-Z0-9_]+=)/);
  }
  return parts.map((c) => c.split(';')[0].trim()).join('; ');
}

async function checkinOne(account) {
  const { user, pass } = account;
  const info = `🔹 地址: ${domain}\n🔑 账号: ${user}\n🔒 密码: ${pass}\n`;

  console.log(`🔸 [${user}] 开始登录请求...`);
  let loginResp;
  try {
    const { resp, body } = await httpRequest({
      url: `${domain}/auth/login`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Accept: 'application/json',
        Origin: domain,
        Referer: `${domain}/auth/login`,
      },
      body: JSON.stringify({ email: user, passwd: pass, remember_me: 'on', code: '' }),
    });
    console.log(`🔸 [${user}] 登录响应 status=${resp.status || resp['status-line']}, body=${(body || '').slice(0, 200)}`);
    console.log(`🔸 [${user}] 原始 Set-Cookie: ${JSON.stringify(resp.headers['Set-Cookie'] || resp.headers['set-cookie'])}`);
    loginResp = resp;
    const json = JSON.parse(body);
    if (json.ret !== 1) {
      console.log(`❌ [${user}] 登录失败: ${json.msg || '未知错误'}`);
      return `${info}❌ 登录失败: ${json.msg || '未知错误'}\n`;
    }
  } catch (e) {
    console.log(`❌ [${user}] 登录请求异常: ${e}`);
    return `${info}❌ 登录请求异常: ${e}\n`;
  }

  const cookie = extractCookies(loginResp);
  console.log(`🔸 [${user}] 提取到 Cookie(完整): ${cookie || '(空)'}`);
  await sleep(1000);

  console.log(`🔸 [${user}] 开始签到请求...`);
  let checkinResult = {};
  try {
    const { body } = await httpRequest({
      url: `${domain}/user/checkin`,
      method: 'post',
      headers: {
        Cookie: cookie,
        'User-Agent': UA,
        Accept: 'application/json',
        Origin: domain,
        Referer: `${domain}/user/panel`,
      },
    });
    console.log(`🔸 [${user}] 签到响应 body=${(body || '').slice(0, 200)}`);
    checkinResult = JSON.parse(body || '{}');
  } catch (e) {
    console.log(`⚠️ [${user}] 签到请求异常: ${e}`);
  }
  const resultEmoji = checkinResult.ret === 1 ? '✅' : '⚠️';
  const resultMsg = checkinResult.msg || '签到结果未知';

  const userInfo = await fetchUserInfo(cookie);

  return `${info}${userInfo}🎉 签到结果: ${resultEmoji} ${resultMsg}\n`;
}

async function fetchUserInfo(cookie) {
  console.log('🔸 开始抓取用户信息...');
  try {
    const { body } = await httpRequest({
      url: `${domain}/user`,
      method: 'get',
      headers: { Cookie: cookie, 'User-Agent': UA },
    });
    console.log(`🔸 用户信息页返回长度: ${(body || '').length}`);

    const chatraMatch = body.match(/window\.ChatraIntegration[\s\S]*?<\/script>/);
    if (!chatraMatch) {
      console.log('⚠️ 未在页面中匹配到 window.ChatraIntegration');
      return '⚠️ 未识别到用户信息\n';
    }
    const chatraScript = chatraMatch[0];

    const expireMatch = chatraScript.match(/'Class_Expire':\s*'(.*?)'/);
    const trafficMatch = chatraScript.match(/'Unused_Traffic':\s*'(.*?)'/);
    const expire = expireMatch ? expireMatch[1] : '未知';
    const traffic = trafficMatch ? trafficMatch[1] : '未知';

    let subLinks = '';
    const linkMatch = body.match(/https:\/\/checkhere\.top\/link\/([a-zA-Z0-9]+)\?sub=1/);
    if (linkMatch) {
      const clashLink = `https://checkhere.top/link/${linkMatch[1]}?clash=1`;
      const v2rayLink = `https://checkhere.top/link/${linkMatch[1]}?sub=3`;
      subLinks = `\n🔗 Clash 订阅: ${clashLink}\n🔗 V2ray 订阅: ${v2rayLink}\n`;
    }

    return `📅 到期时间: ${expire}\n📊 剩余流量: ${traffic}${subLinks}\n`;
  } catch (e) {
    return `⚠️ 用户信息获取失败: ${e}\n`;
  }
}

async function sendTelegram(msg) {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);
  const text = `⏰ 执行时间: ${timeStr}\n\n${msg}`;
  try {
    await httpRequest({
      url: `https://api.telegram.org/bot${botToken}/sendMessage`,
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(text)}&parse_mode=HTML&disable_web_page_preview=true`,
    });
  } catch (e) {
    console.log('❌ Telegram 推送失败: ' + e);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
