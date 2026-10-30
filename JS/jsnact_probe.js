// 版本号: v1.0.0 (江苏 wap.js.10086.cn/nact/action.do 探测脚本: 只把请求和返回的"结构"以通知形式显示, 长内容自动截断, 11 位数字自动遮盖)
// 用途: 找出"签到有礼"点签到时, 页面往 action.do 发了什么 (只看字段名和短内容, 不记录、不上传任何东西)
// 查完后请把模块关掉或删除

const MAXLEN = 16;     // 字符串超过这个长度就只显示开头几个字 + 总长度
const MAXOUT = 700;    // 一条通知最多显示的字数

function maskStr(v) {
  let s = String(v);
  s = s.replace(/\d{11}/g, "<11位数字>");
  if (s.length > MAXLEN) return s.slice(0, 4) + "…(长" + s.length + ")";
  return s;
}

function mask(x, depth) {
  if (x === null || x === undefined) return x;
  if (typeof x === "string") return maskStr(x);
  if (typeof x === "number" || typeof x === "boolean") return x;
  if (depth >= 3) return "…";
  if (Array.isArray(x)) return x.slice(0, 5).map((i) => mask(i, depth + 1));
  if (typeof x === "object") {
    const o = {};
    Object.keys(x).slice(0, 30).forEach((k) => (o[k] = mask(x[k], depth + 1)));
    return o;
  }
  return String(x);
}

function describe(raw) {
  if (raw === undefined || raw === null || raw === "") return "(空)";
  if (typeof raw !== "string") return "(非文本, 长度 " + (raw.length || raw.byteLength || "?") + ")";
  try {
    return JSON.stringify(mask(JSON.parse(raw), 0));
  } catch (e) {}
  // 表单格式 a=1&b=2
  if (/^[^=&\s]+=/.test(raw)) {
    const parts = raw.split("&").slice(0, 30).map((kv) => {
      const i = kv.indexOf("=");
      let k = i < 0 ? kv : kv.slice(0, i);
      let v = i < 0 ? "" : kv.slice(i + 1);
      try { v = decodeURIComponent(v); } catch (e) {}
      return k + "=" + maskStr(v);
    });
    return parts.join("&");
  }
  return maskStr(raw) + " [原文长 " + raw.length + "]";
}

function send(title, text) {
  const t = text.length > MAXOUT ? text.slice(0, MAXOUT) + "…" : text;
  console.log(title + " " + t);
  if (typeof $notification !== "undefined") $notification.post(title, "", t);
}

if (typeof $response !== "undefined") {
  // 返回内容
  send("nact 返回 " + $response.status, describe($response.body));
} else {
  // 请求内容: 只显示地址里的参数名 (不显示参数值) + 请求体的结构
  const url = $request.url || "";
  const q = url.split("?")[1] || "";
  const qkeys = q ? q.split("&").map((p) => p.split("=")[0]).join(",") : "(无)";
  const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  const hnames = Object.keys($request.headers || {}).join(",");
  send("nact 请求 " + $request.method + " " + path,
       "地址参数名: " + qkeys + "\n请求头名: " + hnames + "\n请求体: " + describe($request.body));
}
$done({});
