/**
 * Surge cron 脚本：定时查询硅基流动余额，低于阈值推送通知
 *
 * 在 Surge 脚本配置中添加：
 *   type=cron
 *   cronexp=0 * * * *        （每小时整点执行一次）
 *   wake-system=1
 *
 * 依赖：先由 sf_cookie_capture.js 捕获登录态
 *      （用浏览器打开一次控制台账单页即可，需走 Surge 代理 + MITM）
 *
 * 可配置项见下方 CONFIG。
 */

var CONFIG = {
  // 余额低于此数值时推送提醒（单位：元）
  threshold: 10,
  // 为 true 时每次执行都推送当前余额（调试用）；false 则只在异常/低于阈值/有变动时推送
  alwaysNotify: false,
};

(function () {
  var cookie = $persistentStore.read('sf_cookie');
  var subjectId = $persistentStore.read('sf_subject_id');

  function notify(title, subtitle, body) {
    $notification.post(title, subtitle, body);
  }

  if (!cookie || !subjectId) {
    notify('硅基流动余额', '未捕获到登录态', '请用浏览器打开一次控制台账单页（需经 Surge 代理）');
    return $done();
  }

  $httpClient.get(
    {
      url: 'https://cloud.siliconflow.com/walletd-server/api/v1/subject/profile/peek',
      headers: {
        'Cookie': cookie,
        'x-subject-id': subjectId,
        'Accept': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    },
    function (error, response, data) {
      if (error || !response || response.status !== 200) {
        var code = response ? response.status : '网络错误';
        notify(
          '硅基流动余额',
          '查询失败 (' + code + ')',
          '登录态可能已过期，请重新打开一次账单页刷新'
        );
        return $done();
      }

      var body;
      try {
        body = JSON.parse(data);
      } catch (e) {
        notify('硅基流动余额', '解析失败', '接口返回的不是 JSON');
        return $done();
      }

      // 内部接口无公开文档，按常见字段名尝试提取；命中失败则保存原始返回待人工适配
      var balance = extractBalance(body);
      if (balance === null) {
        $persistentStore.write(String(data).slice(0, 2000), 'sf_last_raw');
        notify('硅基流动余额', '余额字段未识别', '已保存原始返回，请发给制作者适配字段');
        return $done();
      }

      var prevRaw = $persistentStore.read('sf_last_balance');
      var prev = prevRaw ? parseFloat(prevRaw) : NaN;
      $persistentStore.write(String(balance), 'sf_last_balance');
      $persistentStore.write(String(Date.now()), 'sf_last_check');

      var msg = '当前余额 ' + balance.toFixed(2);

      if (CONFIG.alwaysNotify) {
        notify('硅基流动余额', '定时查询', msg);
      } else if (balance < CONFIG.threshold) {
        notify('硅基流动余额', '余额不足提醒', msg + '（低于阈值 ' + CONFIG.threshold + '）');
      } else if (!isNaN(prev) && Math.abs(balance - prev) > 0.005) {
        notify('硅基流动余额', '余额变动', prev.toFixed(2) + ' → ' + balance.toFixed(2));
      }
      // 无变化则静默，不打扰
      $done();
    }
  );

  // 按候选路径逐个尝试提取数字型余额
  function extractBalance(obj) {
    var paths = [
      ['data', 'remaining'],
      ['data', 'remainBalance'],
      ['data', 'availableBalance'],
      ['data', 'balance'],
      ['data', 'totalBalance'],
      ['data', 'chargeBalance'],
      ['data', 'wallet', 'remaining'],
      ['data', 'wallet', 'balance'],
      ['remaining'],
      ['balance'],
    ];
    for (var i = 0; i < paths.length; i++) {
      var v = dig(obj, paths[i]);
      if (typeof v === 'number' && isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '' && isFinite(parseFloat(v))) {
        return parseFloat(v);
      }
    }
    return null;
  }

  function dig(obj, path) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = cur[path[i]];
    }
    return cur;
  }
})();
