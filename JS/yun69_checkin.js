/*
 * 69云自动签到 (Surge JS 版)
 * 移植自: https://github.com/Elykia093/69Yun_Auto_Checkin (Python + GitHub Actions)
 * Version: v1.3 (2026-07-13)
 *
 * 变更历史:
 *   v1.0 (2026-07-13) 首次转换
 *     - 原脚本用 requests + BeautifulSoup 登录/签到/解析用户信息, GitHub Actions 定时触发, Secrets 存账号密码。
 *     - Surge 版改用 $httpClient 做登录/签到请求, Cookie 从 Set-Cookie 手动拼装 (Surge 无 requests 的 cookiejar)。
 *     - 用户信息页解析: 原来用 BeautifulSoup 找 <script> 标签再正则; Surge 版直接对整页 HTML 做正则匹配
 *       window.ChatraIntegration 所在的 <script>...</script> 片段, 再从中提取 Class_Expire / Unused_Traffic。
 *     - 通知: 默认用 Surge $notification 本地推送; 若在 BoxJS 配置了 yun69_bot_token + yun69_chat_id,
 *       则额外发送 Telegram (格式与原脚本一致)。
 *     - 多账号: 原来用 USER1/PASS1, USER2/PASS2... 环境变量; Surge 版改成 BoxJS 存一个 JSON 数组,更好维护。
 *
 *   v1.1 (2026-07-13) 调试排查
 *     - 登录/签到/用户信息抓取每一步都加上 console.log, 之前失败时错误信息只塞进返回字符串,
 *       控制台看不到具体卡在哪一步。
 *     - 主流程开始处打印读取到的账号数, 用于确认 BoxJS 数据是否正常读取到。
 *
 *   v1.2 (2026-07-13) 修复 Cookie 丢失问题
 *     - 根本原因: 登录成功后签到请求返回的是登录页 HTML 而非 JSON, 定位到是 extractCookies() 的问题——
 *       网站把多条 Set-Cookie 合并成一整个逗号分隔字符串返回(而不是数组), 原来的实现按分号切,
 *       只切出了第一条 cookie(uid=...), 后面维持登录态必需的 cookie 全部丢失。
 *     - 改为识别"逗号后紧跟 名字=" 的位置才切分, 避免把 Expires=Thu, 01-Jan... 里的逗号切碎,
 *       从而正确拼出完整的多条 Cookie。
 *     - 登录响应新增打印原始 Set-Cookie 内容和提取后的完整 Cookie(此前完整 Cookie 只打印前 60 字符),
 *       方便确认修复是否生效。
 *     - 实测确认: 签到接口正常返回 JSON, 签到成功。
 *
 *   v1.3 (2026-07-13) 登录请求加自动重试
 *     - 背景: 短时间内连续手动测试触发网站风控, 登录请求报 "Master connection closed: EOF"
 *       (连接层面被对方主动断开, 不是账号密码错误)。正式 cron 一天一次不会触发这种频率型风控,
 *       但为了应对偶发的网络抖动/瞬时限流, 给登录请求加了一次自动重试(间隔 3 秒)。
 *     - 重试仅针对请求本身抛出异常(连接失败/超时等), 不针对"账号密码错误"这类业务层面的失败
 *       (业务失败重试没有意义, 只会加重风控)。
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
  let loginAttempt = 0;
  while (true) {
    loginAttempt++;
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
      break; // 请求本身成功(不管业务是否成功), 跳出重试循环
    } catch (e) {
      // 请求本身抛异常(连接失败/EOF/超时等), 大概率是网络抖动或瞬时限流, 重试一次
      if (loginAttempt < 2) {
        console.log(`⚠️ [${user}] 登录请求异常(第 ${loginAttempt} 次): ${e}, 3 秒后重试`);
        await sleep(3000);
        continue;
      }
      console.log(`❌ [${user}] 登录请求异常(已重试): ${e}`);
      return `${info}❌ 登录请求异常: ${e}\n`;
    }
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
