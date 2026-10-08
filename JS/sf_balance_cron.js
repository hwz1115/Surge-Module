/**
 * Surge cron 脚本：定时查询硅基流动余额（v2）
 *
 * 在 Surge 脚本配置中添加：
 *   type=cron
 *   cronexp=0 * * * *        （每小时整点执行一次）
 *   wake-system=1
 *
 * 调用控制台内部 peek 接口（data.financialInfo.available），
 * 登录态由 sf_cookie_capture.js 捕获。金额为字符串大整数，
 * 除以 divisor 换算为元（recharged=600000000000000 对应 600.00 元）。
 */

var CONFIG = {
  // 余额低于此金额（元）时推送提醒
  threshold: 10,
  // 为 true 则每次执行都推送当前余额（调试用）
  alwaysNotify: false,
  // 接口金额单位换算：原始值 / divisor = 元
  divisor: 1e12,
  // 兜底地址（捕获脚本保存了真实地址后优先用保存的）
  apiUrl:
    'https://cloud.siliconflow.cn/walletd-server/api/v1/subject/profile/peek',
};

(function () {
  var cookie = $persistentStore.read('sf_cookie');
  var subjectId = $persistentStore.read('sf_subject_id');
  var apiUrl = $persistentStore.read('sf_api_url') || CONFIG.apiUrl;

  function notify(title, subtitle, body) {
    $notification.post(title, subtitle, body);
  }

  if (!cookie) {
    notify(
      '硅基流动余额',
      '未捕获到登录态',
      '请用浏览器打开一次控制台账单页（需经 Surge 代理）'
    );
    return $done();
  }

  var headers = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0',
    Cookie: cookie,
  };
  if (subjectId) {
    headers['x-subject-id'] = subjectId;
  }

  $httpClient.get({ url: apiUrl, headers: headers }, function (
    error,
    response,
    data
  ) {
    if (error || !response || response.status !== 200) {
      notify(
        '硅基流动余额',
        '查询失败 (' + (response ? response.status : '网络错误') + ')',
        '登录态可能已过期，请重新打开一次账单页刷新'
      );
      return $done();
    }

    var body;
    try {
      body = JSON.parse(data);
    } catch (e) {
      notify('硅基流动余额', '解析失败', '接口返回不是 JSON');
      return $done();
    }

    if (body.code !== 20000) {
      notify('硅基流动余额', '接口返回异常', 'code=' + body.code);
      return $done();
    }

    var info = body.data && body.data.financialInfo;
    var raw = info && (info.available || info.balance);
    if (raw === undefined || raw === null || raw === '') {
      $persistentStore.write(String(data).slice(0, 2000), 'sf_last_raw');
      notify('硅基流动余额', '余额字段未识别', '已保存原始返回，请发我适配');
      return $done();
    }

    var balance = parseFloat(raw) / CONFIG.divisor;
    if (!isFinite(balance)) {
      notify('硅基流动余额', '余额数值异常', '原始值: ' + raw);
      return $done();
    }

    var prevRaw = $persistentStore.read('sf_last_balance');
    var prev = prevRaw ? parseFloat(prevRaw) : NaN;
    $persistentStore.write(String(balance), 'sf_last_balance');
    $persistentStore.write(String(Date.now()), 'sf_last_check');

    var msg = '当前余额 ' + balance.toFixed(2) + ' 元';
    if (CONFIG.alwaysNotify) {
      notify('硅基流动余额', '定时查询', msg);
    } else if (balance < CONFIG.threshold) {
      notify(
        '硅基流动余额',
        '余额不足提醒',
        msg + '（低于阈值 ' + CONFIG.threshold + ' 元）'
      );
    } else if (!isNaN(prev) && Math.abs(balance - prev) > 0.005) {
      notify(
        '硅基流动余额',
        '余额变动',
        prev.toFixed(2) + ' → ' + balance.toFixed(2) + ' 元'
      );
    }
    // 无变化则静默，不打扰
    $done();
  });
})();
