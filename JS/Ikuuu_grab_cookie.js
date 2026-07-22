/*
 * iKuuu 自动抓取Cookie - Surge版 (单账号)
 * 版本: 20260722-1
 * 更新说明: 首个版本，通过MITM在访问/user页面时自动截取Cookie并写入BoxJS变量
 *
 * 原理:
 * 浏览器打开 iKuuu 网站并登录后，访问个人中心(/user)页面时，
 * 浏览器请求里会带上最新的Cookie。这个脚本会在请求经过Surge时，
 * 把Cookie读出来，存到 ikuuu_cookies 变量里 —— 跟签到脚本(Ikuuu_checkin.js)
 * 读取的是同一个变量，抓到之后签到脚本不用做任何改动。
 *
 * 使用方法:
 * 1. [MITM] hostname 里加上你的iKuuu域名 (比如 ikuuu.win，跟你浏览器登录用的域名一致)
 *    如果域名不是 ikuuu.win，把下面 URL 匹配规则里的域名也改成实际的。
 *
 * 2. Surge [Script] 配置 (跟已有的签到脚本放一起即可):
 *    ikuuu-grab-cookie = type=http-request,pattern=^https?:\/\/[a-zA-Z0-9.-]*ikuuu\.[a-z]+\/user(\?.*)?$,requires-body=false,timeout=10,script-path=Ikuuu_grab_cookie.js
 *
 * 3. 用手机浏览器正常打开 iKuuu 网站，登录后进入个人中心页面(通常登录后会自动跳转到这个页面)，
 *    Surge 就会自动把新Cookie存起来，并弹一条通知告诉你已更新。
 *
 * 注意:
 * - 这个脚本只是"顺手"读取请求头，不会拦截或修改你正常浏览网页的内容，不影响你正常使用网站。
 * - 如果Cookie跟上次存的一样(说明你没有重新登录，只是刷新了页面)，就不会重复弹通知，避免打扰。
 * - 目前只支持单账号；如果之后你想给家人也各存一份，需要再单独改逻辑区分账号，跟我说一声。
 */

const VAR_NAME = "ikuuu_cookies";

const cookie = ($request.headers && ($request.headers["Cookie"] || $request.headers["cookie"])) || "";

if (!cookie) {
  // 没抓到Cookie，不打扰，直接放行请求
  $done({});
} else {
  const previous = $persistentStore.read(VAR_NAME) || "";

  if (cookie === previous) {
    // 跟上次一样，说明不是新登录，静默跳过
    $done({});
  } else {
    $persistentStore.write(cookie, VAR_NAME);
    $notification.post("iKuuu Cookie已更新", "", "已自动保存最新登录Cookie，签到脚本会自动用上");
    $done({});
  }
}
