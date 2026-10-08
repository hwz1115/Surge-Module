/**
 * Surge http-request 脚本：捕获硅基流动控制台登录态（v2）
 *
 * 在 Surge 脚本配置中添加：
 *   type=http-request
 *   pattern=^https:\/\/cloud\.siliconflow\.cn\/walletd-server\/api\/v1\/subject\/
 *
 * 原理：拦截控制台 walletd-server 域名下的 API 请求，把 Cookie 和
 * x-subject-id 存入 $persistentStore；若 URL 含 peek（余额接口），
 * 同时保存完整 URL 供定时查询脚本直接调用，无需硬编码地址。
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

  if (cookie) {
    $persistentStore.write(cookie, 'sf_cookie');
    $persistentStore.write(String(Date.now()), 'sf_cookie_at');
  }
  if (subjectId) {
    $persistentStore.write(subjectId, 'sf_subject_id');
  }
  // 保存余额接口的真实地址（含可能的查询参数），定时任务直接用它
  if ($request.url && $request.url.indexOf('peek') !== -1) {
    $persistentStore.write($request.url, 'sf_api_url');
  }

  if (cookie || subjectId) {
    console.log('[SF] 登录态已捕获/更新');
  }
  $done({});
})();
