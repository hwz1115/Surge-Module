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

    // 3. 组装通知内容：核心参数在前（折叠时先看到），详情紧随其后（展开/长按后看到）
    activeList.forEach((el, index) => {
      const d = detailsResult[index] || {};
      const prefix = objLength < 2 ? "" : `[第 ${index + 1} 条] `;
      const code = el.tfid.substring(0, 4) + "年第" + el.tfid.substring(4, 6) + "号";

      // 核心参数：折叠状态下优先展示
      messageText +=
        prefix + `${code} ${el.strong}${el.name}(${el.enname})\n` +
        `💨 ${el.power}级 ${el.speed}米/秒 | 🫧 ${el.pressure}百帕\n` +
        `🎐 东经${el.lng}° 北纬${el.lat}°\n`;

      // 详情参数：紧跟其后，展开通知后可见
      messageText += `🪁 移速移向：${el.movespeed}km/h、${el.movedirection}\n`;
      if (d.radius7) messageText += `🕖 七级风圈：${d.radius7}\n`;
      if (d.radius10) messageText += `🕙 十级风圈：${d.radius10}\n`;
      if (d.radius12) messageText += `🕛 十二级风圈：${d.radius12}\n`;
      if (d.ckposition) messageText += `🗼 参考位置：${d.ckposition}\n`;
      if (d.jl) messageText += `🎢 未来趋势：${d.jl}\n`;
      messageText += `更新：${el.timeformate}\n\n`;
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
