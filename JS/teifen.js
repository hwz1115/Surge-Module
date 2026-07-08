/**************************
 * @Author: XiaoMao (Optimized by Gemini)
 * @LastMod: 2026-07-08
 *
 * 🌀 实时台风信息播报（异步高效率优化版）
 * 🟢 修复了原版详细信息无法显示的 Bug
 * 🟢 修复了多台风时数据可能错位的问题
 * 🟢 采用 Promise.all 动态等待，告别死板的 setTimeout 延时
 * 🟢 通知正文精简，点击后打开美化版 HTML 详情页
 *
 ********************************/

function Env(name) {
  const isLoon = typeof $loon !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isLoon;
  const isQX = typeof $task !== "undefined";

  const notify = (title = "XiaoMao", subtitle = "", message = "", url = "", url2 = url) => {
    if (isLoon) $notification.post(title, subtitle, message, url);
    if (isSurge) $notification.post(title, subtitle, message, { url });
    if (isQX) $notify(title, subtitle, message, { "open-url": url, "media-url": url2 });
  };

  const get = (url) => {
    return new Promise((resolve) => {
      if (isLoon || isSurge) {
        $httpClient.get(url, (err, resp, body) => resolve({ err, resp, body }));
      } else if (isQX) {
        const req = typeof url === "string" ? { url, method: "GET" } : { ...url, method: "GET" };
        $task.fetch(req).then(
          (resp) => resolve({ err: null, resp, body: resp.body }),
          (err) => resolve({ err, resp: null, body: null })
        );
      } else {
        resolve({ err: "Unknown environment", resp: null, body: null });
      }
    });
  };

  const log = (message) => console.log(message);
  const done = (value = {}) => $done(value);

  return { name, notify, get, log, done };
}

const $ = new Env("XiaoMaoTyhoon");

async function main() {
  try {
    // 1. 获取当前活跃的台风列表
    const activityUrl = encodeURI("https://typhoon.slt.zj.gov.cn/Api/TyhoonActivity");
    const { body: activityBody } = await $.get(activityUrl);

    if (!activityBody) {
      getError("获取台风列表失败，请稍后再试❗️");
      return;
    }

    const activeList = JSON.parse(activityBody);
    if (!activeList || activeList.length === 0) {
      getError("当前无活跃台风，或未监测到数据❗️");
      return;
    }

    const objLength = activeList.length;
    let summaryText = ""; // 通知正文：只放核心基础参数，简短

    // 2. 并发获取每个活跃台风的详细风圈及趋势数据（返回结构化对象，便于渲染 HTML）
    const detailPromises = activeList.map(el => getDetail(el.tfid));
    const detailsResult = await Promise.all(detailPromises);

    // 3. 组装通知摘要
    activeList.forEach((el, index) => {
      const prefix = objLength < 2 ? "" : `[第 ${index + 1} 条] `;
      const code = el.tfid.substring(0, 4) + "年第" + el.tfid.substring(4, 6) + "号";

      summaryText +=
        prefix + `${code} ${el.strong}${el.name}(${el.enname})\n` +
        `💨 ${el.power}级 ${el.speed}米/秒 | 🫧 ${el.pressure}百帕\n` +
        `🎐 东经${el.lng}° 北纬${el.lat}°\n\n`;
    });

    // 4. 生成美化版 HTML 详情页
    const detailHtml = buildDetailHtml(activeList, detailsResult);
    const detailUrl = "data:text/html;charset=utf-8," + encodeURIComponent(detailHtml);

    // 5. 推送通知：正文精简摘要，点击打开详情页
    $.notify("🌀XiaoMao_台风监测", `监测到 ${objLength} 条台风数据 · 点击查看详情`, summaryText.trim(), detailUrl);
    $.log(summaryText);

  } catch (e) {
    $.log(`脚本运行出错: ${e}`);
    getError("脚本解析运行出错，请检查日志❗️");
  } finally {
    $.done({});
  }
}

// 获取风圈和趋势半径信息，返回结构化对象
async function getDetail(tfid) {
  const url = encodeURI(`https://typhoon.slt.zj.gov.cn/Api/TyphoonInfo/${tfid}`);
  const { body } = await $.get(url);
  if (!body) return null;

  try {
    const obj2 = JSON.parse(body);
    if (!obj2.points || obj2.points.length === 0) return null;

    const tf_D = obj2.points[obj2.points.length - 1];

    const formatRadius = (radiusStr) => {
      if (!radiusStr) return null;
      const b = radiusStr.split("|").map(Number);
      const startNum = Math.min(...b);
      const endNum = Math.max(...b);
      return startNum === endNum ? `${startNum}公里` : `${startNum}~${endNum}公里`;
    };

    return {
      radius7: formatRadius(tf_D.radius7),
      radius10: formatRadius(tf_D.radius10),
      radius12: formatRadius(tf_D.radius12),
      ckposition: tf_D.ckposition ? tf_D.ckposition.replace(/\s+/g, "") : null,
      jl: tf_D.jl ? tf_D.jl.replace(/\s+/g, "") : null,
      pathPoints: obj2.points.length
    };
  } catch (e) {
    return null;
  }
}

// 简单转义，防止台风名称/文本里出现的特殊字符破坏 HTML 结构
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 生成深色主题、卡片式的 HTML 详情页
function buildDetailHtml(activeList, detailsResult) {
  const cardsHtml = activeList.map((el, index) => {
    const d = detailsResult[index] || {};
    const code = el.tfid.substring(0, 4) + "年第" + el.tfid.substring(4, 6) + "号";

    const rows = [
      ["📍 中心位置", `东经 ${escapeHtml(el.lng)}° 北纬 ${escapeHtml(el.lat)}°`],
      ["🌊 中心风力", `${escapeHtml(el.power)} 级（${escapeHtml(el.speed)} 米/秒）`],
      ["🫧 中心气压", `${escapeHtml(el.pressure)} 百帕`],
      ["🪁 移速移向", `${escapeHtml(el.movespeed)} 公里/小时、${escapeHtml(el.movedirection)}`],
    ];
    if (d.radius7) rows.push(["🕖 七级风圈半径", escapeHtml(d.radius7)]);
    if (d.radius10) rows.push(["🕙 十级风圈半径", escapeHtml(d.radius10)]);
    if (d.radius12) rows.push(["🕛 十二级风圈半径", escapeHtml(d.radius12)]);
    if (d.ckposition) rows.push(["🗼 参考位置", escapeHtml(d.ckposition)]);
    if (d.jl) rows.push(["🎢 未来趋势", escapeHtml(d.jl)]);

    const rowsHtml = rows.map(([label, value]) => `
        <div class="row">
          <span class="label">${label}</span>
          <span class="value">${value}</span>
        </div>`).join("");

    return `
      <div class="card">
        <div class="card-header">
          <span class="typhoon-icon">🌀</span>
          <div>
            <div class="title">${escapeHtml(code)} ${escapeHtml(el.strong)}${escapeHtml(el.name)}</div>
            <div class="subtitle">${escapeHtml(el.enname)}</div>
          </div>
        </div>
        ${rowsHtml}
        <div class="updated">更新时间：${escapeHtml(el.timeformate)}</div>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>台风详情</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d0d0f;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    padding: 20px 16px 40px;
  }
  .page-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 20px;
    text-align: center;
    color: #ffffff;
  }
  .card {
    background: #1c1c1e;
    border-radius: 16px;
    padding: 18px 16px;
    margin-bottom: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .typhoon-icon { font-size: 28px; }
  .title { font-size: 17px; font-weight: 700; color: #ff9500; }
  .subtitle { font-size: 12px; color: #8e8e93; margin-top: 2px; }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 6px 0;
    font-size: 13px;
    line-height: 1.5;
    gap: 12px;
  }
  .label { color: #8e8e93; flex-shrink: 0; }
  .value { color: #ffffff; text-align: right; }
  .updated {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 11px;
    color: #636366;
    text-align: right;
  }
  .footer {
    text-align: center;
    font-size: 11px;
    color: #48484a;
    margin-top: 20px;
  }
</style>
</head>
<body>
  <div class="page-title">🌀 实时台风详情</div>
  ${cardsHtml}
  <div class="footer">数据来源：浙江省气象局</div>
</body>
</html>`;
}

function getError(params = "") {
  $.notify(
    "🌀XiaoMao_台风监测",
    "",
    "🚧 " + params,
    "https://i.pixiv.re/img-original/img/2021/01/01/21/42/56/86736781_p0.jpg"
  );
}

// 启动执行
main();
