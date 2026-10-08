/**
 * 版本：v1.4（2026-10-08）每次查询都发通知；余额低于设定值时标题改为"余额偏低"
 * 历史：v1.3 余额换算成元；v1.2 支持 Cookie / Authorization 两种登录方式；v1.1 合并成单文件；v1.0 拆分版
 *
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
        // 接口返回的是放大 1 万亿倍的整数，换算成元；数值本来就小的则不动
        if (!isNaN(n)) found.push({ key: path, value: Math.abs(n) >= 1e9 ? n / 1e12 : n });
      }
    })(json, '');

    if (!found.length) {
      console.log('[SF] 没找到余额字段，原始返回: ' + String(body).slice(0, 300));
      $notification.post('硅基流动', '没找到余额字段', '请把日志里的返回内容发给作者调整');
      return $done();
    }

    function fmt(v) { return (Math.round(v * 100) / 100).toFixed(2); }
    var mainItem = found[0];
    for (var i = 0; i < found.length; i++) {
      if (/(^|\.)balance$/i.test(found[i].key)) { mainItem = found[i]; break; }
    }
    var main = mainItem.value;
    var detail = found.slice(0, 3).map(function (f) {
      return f.key.split('.').pop() + ': ' + fmt(f.value);
    }).join('  ');

    // 每次查询都通知；低于设定金额时标题提示偏低
    var title = main < threshold ? '硅基流动 · 余额偏低' : '硅基流动 · 当前余额';
    $notification.post(title, '剩余 ' + fmt(main) + ' 元', detail);

    console.log('[SF] 余额 ' + fmt(main) + ' 元（' + detail + '）');
    $done();
  });
})();
