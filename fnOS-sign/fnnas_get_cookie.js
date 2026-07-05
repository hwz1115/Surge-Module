/*
[Script]
飞牛论坛获取Cookie = type=http-request,pattern=^https:\/\/club\.fnnas\.com\/.*,requires-body=false,max-size=0,script-path=fnnas_get_cookie.js
*/

const cookie = $request.headers['Cookie'] || $request.headers['cookie'];

if (cookie) {
  // 排除一些不包含关键登录信息的请求，尽量确保拿到的是有效登录 Cookie
  if (cookie.includes('bbs_sid') || cookie.includes('bbs_token') || cookie.includes('saltkey')) {
    $persistentStore.write(cookie, "fnnas_cookie");
    $notification.post("飞牛论坛签到", "🎉 Cookie 获取成功", "已成功保存登录凭证，可关闭此重写规则。");
    console.log("【飞牛论坛】成功获取并保存 Cookie: " + cookie);
  }
}

$done({});
