/**
 * Surge http-request：硅基流动登录态捕获（v3 加强版）
 *
 * 配置建议：
 *   type=http-request
 *   pattern=^https:\/\/(cloud|account)\.siliconflow\.cn\/
 *   （先放宽，确认能命中后再收窄）
 *
 * 务必开启 MitM：cloud.siliconflow.cn, account.siliconflow.cn
 */
(function () {
  var headers = $request.headers || {};
  var url = $request.url || '';

  function getHeader(name) {
    var lower = name.toLowerCase();
    for (var k in headers) {
      if (k.toLowerCase() === lower) return headers[k];
    }
    return null;
  }

  // 打印关键信息，方便在 Surge 脚本日志里排查
  console.log('[SF] 命中请求: ' + url);
  var allHeaderKeys = Object.keys(headers).map(function (k) {
    return k;
  });
  console.log('[SF] 请求头字段: ' + allHeaderKeys.join(', '));

  var cookie = getHeader('Cookie');
  var subjectId =
    getHeader('x-subject-id') ||
    getHeader('X-Subject-Id') ||
    getHeader('x-subjectid');
  var auth = getHeader('Authorization');
  var token =
    getHeader('token') ||
    getHeader('x-token') ||
    getHeader('X-Token') ||
    getHeader('access-token');

  if (cookie) {
    $persistentStore.write(cookie, 'sf_cookie');
    $persistentStore.write(String(Date.now()), 'sf_cookie_at');
    console.log('[SF] Cookie 已保存，长度=' + cookie.length);
  } else {
    console.log('[SF] 无 Cookie');
  }

  if (subjectId) {
    $persistentStore.write(subjectId, 'sf_subject_id');
    console.log('[SF] x-subject-id 已保存: ' + subjectId);
  }

  if (auth) {
    $persistentStore.write(auth, 'sf_authorization');
    console.log('[SF] Authorization 已保存');
  }

  if (token) {
    $persistentStore.write(token, 'sf_token');
    console.log('[SF] token 已保存');
  }

  // 余额/账单相关接口：保存完整 URL
  var balanceKeywords = [
    'peek',
    'financial',
    'balance',
    'wallet',
    'subject',
    'expense',
    'bill',
    'account',
    'profile',
  ];
  var isBalanceApi = balanceKeywords.some(function (kw) {
    return url.toLowerCase().indexOf(kw) !== -1;
  });
  if (isBalanceApi) {
    $persistentStore.write(url, 'sf_api_url');
    console.log('[SF] 疑似余额接口 URL 已保存: ' + url);
  }

  if (cookie || subjectId || auth || token) {
    console.log('[SF] 登录态已捕获/更新');
  } else {
    console.log('[SF] 本请求无可用登录态字段');
  }

  $done({});
})();
