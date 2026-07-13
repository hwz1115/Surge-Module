/*
 * iKuuu机场每日签到 - Surge版 (多账号 + 失效提醒)
 * 版本: 20260713-1
 * 更新说明: 首个版本，实现多账号Cookie签到 + 失效检测通知
 *
 * 使用方法:
 * 1. BoxJS变量 ikuuu_cookies，格式：一行一个账号，name&cookie
 *    示例：
 *      主账号&crisp-client%2Fsession...; PHPSESSID=...
 *      小号&crisp-client%2Fsession...; PHPSESSID=...
 *    (只有一个账号也可以只写一行，name可省略，直接写Cookie)
 *
 * 2. Surge [Script] 配置:
 *    ikuuu-checkin = type=cron,cronexp="30 8 * * *",wake-system=1,timeout=60,script-path=ikuuu_checkin.js
 *
 * 3. [MITM] hostname 添加签到用的主域名 (如 ikuuu.win)，与浏览器登录时的域名一致
 */

const ENV_VAR_NAME = "ikuuu_cookies";
const HOST = $persistentStore.read("ikuuu_host") || "ikuuu.win"; // 主域名，可通过BoxJS单独配置覆盖
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const raw = $persistentStore.read(ENV_VAR_NAME) || $argument || "";

if (!raw.trim()) {
  $notification.post("iKuuu签到", "未配置账号", "请在BoxJS填写 ikuuu_cookies 变量");
  $done();
} else {
  main();
}

function parseAccounts(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map((line, idx) => {
    if (line.includes("&")) {
      const sepIndex = line.indexOf("&");
      return { name: line.slice(0, sepIndex) || `账号${idx + 1}`, cookie: line.slice(sepIndex + 1) };
    }
    return { name: `账号${idx + 1}`, cookie: line };
  });
}

async function main() {
  const accounts = parseAccounts(raw);
  const results = [];

  for (const acc of accounts) {
    try {
      const msg = await checkinOne(acc.cookie);
      results.push(`✅ ${acc.name}：${msg}`);
    } catch (e) {
      results.push(`❌ ${acc.name}：${e}`);
    }
  }

  $notification.post("iKuuu签到结果", `共${accounts.length}个账号`, results.join("\n"));
  $done();
}

function checkinOne(cookie) {
  return new Promise((resolve, reject) => {
    $httpClient.post(
      {
        url: `https://${HOST}/user/checkin`,
        headers: {
          "Cookie": cookie,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": UA
        },
        body: ""
      },
      (err, resp, body) => {
        if (err) return reject(`请求失败 ${err}`);

        const status = resp ? resp.status : 0;
        const finalUrl = (resp && resp.headers && (resp.headers["Location"] || resp.headers["location"])) || "";

        // Cookie失效场景：跳转登录页 或 直接返回非200且内容像登录页
        if (finalUrl.includes("/auth/login") || (body && body.includes("auth/login"))) {
          return reject("Cookie已失效，请重新登录网站更新Cookie");
        }

        try {
          const json = JSON.parse(body);
          if (json && json.msg) {
            resolve(json.msg);
          } else {
            resolve(JSON.stringify(json));
          }
        } catch (e) {
          // 非JSON，多半是被重定向到了登录页HTML
          if (body && (body.includes("邮箱") && body.includes("密码"))) {
            reject("Cookie已失效，请重新登录网站更新Cookie");
          } else {
            resolve((body || `状态码${status}`).slice(0, 80));
          }
        }
      }
    );
  });
}
