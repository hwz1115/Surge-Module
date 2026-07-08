/**************************
 * @Author: XiaoMao (Optimized by Gemini)
 * @LastMod: 2026-07-08
 *
 * 🌀 实时台风信息播报（异步高效率优化版）
 * 🟢 修复了原版详细信息无法显示的 Bug
 * 🟢 修复了多台风时数据可能错位的问题
 * 🟢 采用 Promise.all 动态等待，告别死板的 setTimeout 延时
 * 🟢 核心参数在前、详情紧随其后，靠系统原生长按/展开查看完整内容（不跳转外部链接）
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
    let messageText = ""; // 通知正文：前几行是核心参数（折叠态可见），后面是详情（展开后可见）

    // 2. 并发获取每个活跃台风的详细风圈及趋势数据
    const detailPromises = activeList.map(el => getDetail(el.tfid));
    const detailsResult = await Promise.all(detailPromises);

    // 3. 组装通知内容：核心参数 → 空行 → 详情参数 → 空行 → 更新时间，层次分明不拥挤
    activeList.forEach((el, index) => {
      const d = detailsResult[index] || {};
      const prefix = objLength < 2 ? "" : `【第 ${index + 1} 条】\n`;
      const code = el.tfid.substring(0, 4) + "年第" + el.tfid.substring(4, 6) + "号";

      // 风圈半径合并成一行，只保留实际存在的档位，避免逐行堆砌
      const radiusParts = [];
      if (d.radius7) radiusParts.push(`7级${d.radius7}`);
      if (d.radius10) radiusParts.push(`10级${d.radius10}`);
      if (d.radius12) radiusParts.push(`12级${d.radius12}`);
      const radiusLine = radiusParts.length ? `🌀 风圈：${radiusParts.join(" · ")}\n` : "";

      messageText += prefix;

      // 核心参数
      messageText +=
        `${code} ${el.strong}${el.name}(${el.enname})\n` +
        `💨 ${el.power}级 ${el.speed}米/秒　🫧 ${el.pressure}百帕\n` +
        `📍 东经${el.lng}° 北纬${el.lat}°\n`;

      messageText += "\n"; // 核心与详情之间留白

      // 详情参数
      messageText += `🪁 ${el.movespeed}km/h ${el.movedirection}\n`;
      if (radiusLine) messageText += radiusLine;
      if (d.ckposition) messageText += `🗼 ${d.ckposition}\n`;
      if (d.jl) messageText += `🎢 ${d.jl}\n`;

      messageText += "\n"; // 详情与更新时间之间留白
      messageText += `⏱ 更新：${el.timeformate}\n\n\n`;
    });

    // 4. 推送通知：不设置 url，避免点击后跳转到脚本本身；靠系统长按/展开显示完整内容
    $.notify("🌀XiaoMao_台风监测", `监测到 ${objLength} 条台风数据`, messageText.trim());
    $.log(messageText);

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
