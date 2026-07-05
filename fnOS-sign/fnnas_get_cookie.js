const cookie = $request.headers['Cookie'] || $request.headers['cookie'];
const url = $request.url;

if (cookie) {
  // 严格校验：只有同时包含 saltkey 和 auth，或者包含了登录标记，才算有效登录 Cookie
  // 避免抓到未登录时的临时恶意、访客 Cookie
  if ((cookie.includes('saltkey') && cookie.includes('auth')) || cookie.includes('bbs_token')) {
    $persistentStore.write(cookie, "fnnas_cookie");
    $notification.post("飞牛论坛签到", "🎉 真正登录 Cookie 获取成功", "已成功锁定有效会员凭证！");
    console.log("【飞牛论坛】成功抓取合法登录 Cookie: " + cookie);
  }
}

// 提取真正的 formhash
if (url.includes('club.fnnas.com')) {
  const body = $response.body;
  if (body) {
    // 过滤掉登录页面或未登录的 formhash，寻找带有用户退出链接或特定用户特征页面的 formhash
    if (body.includes('member.php?mod=logging&action=logout') || body.includes('访问控制') || body.includes('my') || body.includes('uid')) {
      const formhashMatch = body.match(/name="formhash" value="([a-zA-Z0-9]+)"/) || body.match(/formhash=([a-zA-Z0-9]+)/);
      if (formhashMatch && formhashMatch[1]) {
        $persistentStore.write(formhashMatch[1], "fnnas_formhash");
        $notification.post("飞牛论坛签到", "🎯 Formhash 获取成功", `已获取到登录状态下的安全密钥: ${formhashMatch[1]}`);
        console.log("【飞牛论坛】当前登录态 Formhash: " + formhashMatch[1]);
      }
    }
  }
}

$done({});
