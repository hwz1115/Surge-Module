/**
 * 硅基流动余额监控（单文件版）
 * 一个脚本两种用途，自动判断：
 *   1) 被 http-request 触发（你打开控制台时）→ 保存登录态
 *   2) 被 cron 触发（定时）→ 查询余额并推送
 */
(function () {
  var isCapture = typeof $request !== 'undefined';

  // ---------- 通用小工具 ----------
  function getHeader(headers, name) {
    var lower = name.toLowerCase();
    for (var k in headers) if (k.toLowerCase() === lower) return headers[k];
    return null;
  }
  function parseArgs() {
    var o = {};
    if (typeof $argument === 'string') {
      $argument.split('&').forEach(function (p) {
        var i = p.indexOf('=');
        if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
      });
    }
    return o;
  }

  // ---------- 模式一：捕获登录态 ----------
  if (isCapture) {
    var h = $request.headers || {};
    var cookie = getHeader(h, 'Cookie');
    var sid = getHeader(h, 'x-subject-id');
    var auth = getHeader(h, 'Authorization');
    var changed = false;
    console.log('[SF] 本次请求带的头: ' + Object.keys(h).join(', '));

    if (cookie && cookie !== $persistentStore.read('sf_cookie')) {
      $persistentStore.write(cookie, 'sf_cookie');
      $persistentStore.write(String(Date.now()), 'sf_cookie_at');
      changed = true;
    }
    if (auth && auth !== $persistentStore.read('sf_auth')) {
      $persistentStore.write(auth, 'sf_auth');
      changed = true;
    }
    if (sid && sid !== $persistentStore.read('sf_subject_id')) {
      $persistentStore.write(sid, 'sf_subject_id');
      changed = true;
    }
    // 记住余额接口地址（含 peek 的那个），定时查询直接用
    if ($request.url && $request.url.indexOf('peek') !== -1) {
      $persistentStore.write($request.url, 'sf_api_url');
    }
    if (changed) {
      console.log('[SF] 登录态已更新');
      $notification.post('硅基流动', '登录态已捕获', '之后会自动定时查询余额');
    }
    $done({});
    return;
  }

  // ---------- 模式二：定时查询余额 ----------
  var args = parseArgs();
  var threshold = parseFloat(args.threshold || '10'); // 低于多少元提醒
  var cookieSaved = $persistentStore.read('sf_cookie');
  var subjectId = $persistentStore.read('sf_subject_id');
  var authSaved = $persistentStore.read('sf_auth');
  var url = $persistentStore.read('sf_api_url');

  if ((!cookieSaved && !authSaved) || !url) {
    $notification.post('硅基流动', '还没有登录态', '请用开着 Surge 的手机打开并刷新一次控制台页面');
    return $done();
  }

  var headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Accept': 'application/json'
  };
  if (cookieSaved) headers['Cookie'] = cookieSaved;
  if (authSaved) headers['Authorization'] = authSaved;
  if (subjectId) headers['x-subject-id'] = subjectId;

  $httpClient.get({ url: url, headers: headers, timeout: 15 }, function (err, resp, body) {
    if (err) {
      console.log('[SF] 请求失败: ' + err);
      return $done(); // 网络问题不打扰
    }
    var status = resp && resp.status;
    var json = null;
    try { json = JSON.parse(body); } catch (e) {}

    // 登录过期
    if (status === 401 || status === 403 || (json && (json.code === 401 || json.code === 40001))) {
      $notification.post('硅基流动', '登录已过期', '请重新打开并刷新一次控制台页面');
      return $done();
    }
    if (!json) {
      console.log('[SF] 返回内容不是 JSON: ' + String(body).slice(0, 200));
      return $done();
    }

    // 在返回内容里找"余额"相关的数字
    var found = [];
    (function walk(obj, path) {
      if (obj && typeof obj === 'object') {
        for (var k in obj) walk(obj[k], path ? path + '.' + k : k);
      } else if (/balance|remain|credit|余额/i.test(path)) {
        var n = parseFloat(obj);
        if (!isNaN(n)) found.push({ key: path, value: n });
      }
    })(json, '');

    if (!found.length) {
      console.log('[SF] 没找到余额字段，原始返回: ' + String(body).slice(0, 300));
      $notification.post('硅基流动', '没找到余额字段', '请把日志里的返回内容发给作者调整');
      return $done();
    }

    var main = found[0].value;
    var detail = found.slice(0, 3).map(function (f) {
      return f.key.split('.').pop() + ': ' + f.value;
    }).join('  ');

    var now = new Date();
    var today = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    var lastDaily = $persistentStore.read('sf_last_daily');
    var lastLow = parseInt($persistentStore.read('sf_last_low') || '0', 10);

    // 余额低：最多每 6 小时提醒一次
    if (main < threshold && Date.now() - lastLow > 6 * 3600 * 1000) {
      $persistentStore.write(String(Date.now()), 'sf_last_low');
      $notification.post('硅基流动 · 余额偏低', '剩余 ' + main + ' 元', detail);
    }
    // 每天早上 8 点后第一次运行，发一条日报
    else if (now.getHours() >= 8 && lastDaily !== today) {
      $persistentStore.write(today, 'sf_last_daily');
      $notification.post('硅基流动 · 今日余额', '剩余 ' + main + ' 元', detail);
    }

    console.log('[SF] 余额 ' + main + '（' + detail + '）');
    $done();
  });
})();
