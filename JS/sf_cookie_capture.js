/**
 * Surge http-request 脚本：捕获硅基流动控制台登录态
 *
 * 在 Surge 脚本配置中添加：
 *   type=http-request
 *   pattern=^https:\/\/cloud\.siliconflow\.com\/walletd-server\/api\/v1\/subject\/profile\/peek
 *
 * 原理：当你在浏览器打开硅基流动控制台账单页时，该页面会请求上面的
 * 内部 wallet 接口。本脚本拦截该请求，把 Cookie 和 x-subject-id 存入
 * $persistentStore，供定时查询脚本使用。API Key 不需要。
 */
(function () {
  var headers = $request.headers || {};

  function getHeader(name) {
    var lower = name.toLowerCase();
    for (var k in headers) {
      if (k.toLowerCase() === lower) return headers[k];
    }
    return null;
  }

  var cookie = getHeader('Cookie');
  var subjectId = getHeader('x-subject-id');
  var updated = false;

  if (cookie) {
    $persistentStore.write(cookie, 'sf_cookie');
    $persistentStore.write(String(Date.now()), 'sf_cookie_at');
    updated = true;
  }
  if (subjectId) {
    $persistentStore.write(subjectId, 'sf_subject_id');
    updated = true;
  }

  if (updated) {
    console.log('[SF] 登录态已捕获/更新');
  }
  $done({});
})();
