/**************************
 * @LastMod: 2026-07-08
 *
 * 🌀 实时台风信息播报（异步高效率优化版）
 * 🟢 修复了原版详细信息无法显示的 Bug
 * 🟢 修复了多台风时数据可能错位的问题
 * 🟢 采用 Promise.all 动态等待，告别死板的 setTimeout 延时
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
    let returnText = "";

    // 2. 并发获取每个活跃台风的详细风圈及趋势数据
    const detailPromises = activeList.map(el => getDetail(el.tfid));
    const detailsResult = await Promise.all(detailPromises);

    // 3. 完美组装数据（顺序绝对一致）
    activeList.forEach((el, index) => {
      const detailText = detailsResult[index] || "";

      const tfInfo =
        "[" + el.timeformate + "] " + el.tfid.substring(0, 4) + "年第" + el.tfid.substring(4, 6) + "号 " + el.strong + el.name + "(" + el.enname + ")\n" +
        "💨 当前风速：" + el.speed + " 米/秒\n" +
        "🪁 移速移向：" + el.movespeed + " 公里/小时、" + el.movedirection + "\n" +
        "🎐 中心位置：东经 " + el.lng + "°、北纬 " + el.lat + "°\n" +
        "🫧 中心气压：" + el.pressure + " 百帕\n" +
        "🌊 中心风力：" + el.power + " 级\n\n" +
        detailText + "\n\n";

      returnText += (objLength < 2 ? "" : `[第 ${index + 1} 条] `) + tfInfo;
    });

    // 4. 推送通知
    $.notify("🌀XiaoMao_台风监测", `监测到 ${objLength} 条台风数据`, returnText.trim());
    $.log(returnText);

  } catch (e) {
    $.log(`脚本运行出错: ${e}`);
    getError("脚本解析运行出错，请检查日志❗️");
  } finally {
    $.done({});
  }
}

// 获取风圈和趋势半径信息
async function getDetail(tfid) {
  const url = encodeURI(`https://typhoon.slt.zj.gov.cn/Api/TyphoonInfo/${tfid}`);
  const { body } = await $.get(url);
  if (!body) return "";

  try {
    const obj2 = JSON.parse(body);
    if (!obj2.points || obj2.points.length === 0) return "";

    // 取最新一个路径点的数据
    const tf_D = obj2.points[obj2.points.length - 1];
    let radius7 = "", radius10 = "", radius12 = "";

    const formatRadius = (radiusStr, label) => {
      if (!radiusStr) return "";
      const b = radiusStr.split("|").map(Number);
      const startNum = Math.min(...b);
      const endNum = Math.max(...b);
      return startNum === endNum ? `${label}：${startNum}公里\n` : `${label}：${startNum}~${endNum}公里\n`;
    };

    radius7 = formatRadius(tf_D.radius7, "🕖 七级半径");
    radius10 = formatRadius(tf_D.radius10, "🕙 十级半径");
    radius12 = formatRadius(tf_D.radius12, "🕛 十二级半径");

    const ckposition = tf_D.ckposition ? "🗼 参考位置：" + tf_D.ckposition.replace(/\s+/g, "") + "\n" : "";
    const jl = tf_D.jl ? "🎢 未来趋势：" + tf_D.jl.replace(/\s+/g, "") + "\n" : "";

    return (radius7 + radius10 + radius12 + ckposition + jl).trim();
  } catch (e) {
    return "";
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
