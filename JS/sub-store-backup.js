// 版本: v1.0.0
// Sub-Store 自动备份脚本（Surge 定时脚本）
// 作用：定时把 Sub-Store 的全部数据（订阅、组合、文件、设置）备份到 GitHub Gist。
// 安全：如果后端是空的（比如刚重装 Surge），自动跳过，不会把 Gist 里的好备份覆盖掉。
// 需要：官方 Sub-Store 模块已打开；Sub-Store「我的」页面里已填好 GitHub 用户名和 Token。

const BASE = "https://sub.store";
const TITLE = "Sub-Store 自动备份";

function parseArgs(s) {
  const o = {};
  if (!s) return o;
  s.split("&").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  });
  return o;
}

const args = parseArgs(typeof $argument === "string" ? $argument : "");
const notifySuccess = /^(true|1|on|yes)$/i.test(args.notify_success || "");

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opt = {
      url: BASE + path,
      timeout: 60,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opt.body = JSON.stringify(body);
    $httpClient[method](opt, (err, resp, data) => {
      if (err) return reject(new Error(String(err)));
      resolve({ status: resp.status, body: data || "" });
    });
  });
}

function tryJSON(t) {
  try {
    return JSON.parse(t);
  } catch (e) {
    return null;
  }
}

function cut(s) {
  return String(s).replace(/\s+/g, " ").slice(0, 120);
}

function notify(msg) {
  $notification.post(TITLE, "", msg);
}

function count(x) {
  return Array.isArray(x) ? x.length : 0;
}

(async () => {
  try {
    // 第 1 步：确认后端在线
    const env = await request("get", "/api/utils/env");
    if (env.status !== 200 || !/success/.test(env.body)) {
      notify("连不上 Sub-Store 后端。请确认 Surge 开着，并且官方 Sub-Store 模块已打开。");
      return;
    }

    // 第 2 步：读取当前数据，确认不是空的
    const st = await request("get", "/api/storage");
    let d = tryJSON(st.body);
    if (d && !d.subs && d.data) {
      d = typeof d.data === "string" ? tryJSON(d.data) : d.data;
    }
    if (st.status !== 200 || !d) {
      notify("读不到后端数据，已跳过备份（HTTP " + st.status + "）。");
      return;
    }
    if (!("subs" in d)) {
      notify("看不懂后端数据的格式，已跳过备份。内容开头：" + cut(Object.keys(d).join(",")));
      return;
    }
    const n = {
      subs: count(d.subs),
      collections: count(d.collections),
      files: count(d.files),
      artifacts: count(d.artifacts),
    };
    if (n.subs + n.collections + n.files + n.artifacts === 0) {
      notify("后端是空的，已跳过备份，避免覆盖 Gist 里的好备份。请先在 Sub-Store「我的」里点「下载」还原数据。");
      return;
    }

    // 第 3 步：上传备份
    let r = await request("get", "/api/utils/backup?action=upload");
    if (r.status === 404 || r.status === 405) {
      r = await request("post", "/api/utils/backup", { action: "upload" });
    }
    const j = tryJSON(r.body);
    const ok =
      r.status >= 200 &&
      r.status < 300 &&
      !(j && j.status && j.status !== "success");

    if (ok) {
      if (notifySuccess) {
        notify(
          "备份成功：订阅 " + n.subs + " 条，组合 " + n.collections + " 个，文件 " + n.files + " 个。"
        );
      }
    } else {
      notify("备份失败（HTTP " + r.status + "）：" + cut(r.body));
    }
  } catch (e) {
    notify("备份出错：" + cut(e.message || e));
  }
})().finally(() => $done());
