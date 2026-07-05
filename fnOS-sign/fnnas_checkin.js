/*
[Script]
飞牛论坛自动签到 = type=cron,cronexp="0 9 * * *",wake-system=1,timeout=30,script-path=fnnas_checkin.js
*/

const cookie = $persistentStore.read("fnnas_cookie");
const iyuuToken = $persistentStore.read("fnnas_iyuu_token") || ""; // 可选：IYUU通知

if (!cookie) {
  $notification.post("飞牛论坛签到", "❌ 签到失败", "未检测到本地 Cookie，请先登录论坛获取。");
  $done();
} else {
  // 飞牛论坛标准的签到/打卡 API（通常为 Discuz! 或类似架构的插件，这里以标准插件路径为例，实际路径可通过抓包确认）
  // 常见的签到路径形如: https://club.fnnas.com/plugin.php?id=dsu_amupper:pper&action=qiandao&infloat=yes&handlekey=qiandao&inajax=1&ajaxtarget=fwin_content_qiandao
  // 注意：此处 URL 需要根据飞牛论坛真实的签到请求进行微调
  const signUrl = "https://club.fnnas.com/plugin.php?id=k_misign:sign&operation=qiandao&format=json"; 

  const request = {
    url: signUrl,
    headers: {
      "Cookie": cookie,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Referer": "https://club.fnnas.com/"
    }
  };

  $httpClient.get(request, function(error, response, data) {
    if (error) {
      $notification.post("飞牛论坛签到", "❌ 请求失败", `网络错误: ${error}`);
      pushNotification(`飞牛论坛签到失败：网络错误 ${error}`);
    } else {
      if (response.status === 200) {
        console.log("【飞牛论坛】签到返回数据: " + data);
        
        // 解析返回的状态，根据飞牛论坛的实际返回做判断（通常包含 "成功"、"已经签到" 或 json 状态）
        if (data.includes("今日已签") || data.includes("已经签到")) {
          $notification.post("飞牛论坛签到", "🔁 今日已签到", "您今天已经完成了签到，请勿重复操作。");
        } else if (data.includes("签到成功") || data.includes("恭喜你")) {
          $notification.post("飞牛论坛签到", "✅ 签到成功", "恭喜，飞牛论坛自动签到成功！");
          pushNotification("飞牛论坛：自动签到成功！");
        } else {
          $notification.post("飞牛论坛签到", "⚠️ 状态未知", "请前往控制台查看日志响应体。");
          console.log("未知响应体: " + data);
        }
      } else {
        $notification.post("飞牛论坛签到", "❌ 签到失败", `服务器返回状态码: ${response.status}`);
      }
    }
    $done();
  });
}

// 兼容原项目的 IYUU 微信通知功能
function pushNotification(text) {
  if (!iyuuToken) return;
  const url = `https://iyuu.cn/${iyuuToken}.send?text=${encodeURIComponent('飞牛签到通知')}&desp=${encodeURIComponent(text)}`;
  $httpClient.get(url, function(error, response, data) {
    console.log("【IYUU通知】发送结果: " + data);
  });
}
