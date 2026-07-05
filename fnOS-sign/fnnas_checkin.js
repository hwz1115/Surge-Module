const cookie = $persistentStore.read("fnnas_cookie");
const formhash = $persistentStore.read("fnnas_formhash");

if (!cookie) {
  $notification.post("飞牛论坛签到", "❌ 签到失败", "未检测到本地 Cookie，请先登录论坛获取。");
  $done();
} else if (!formhash) {
  $notification.post("飞牛论坛签到", "❌ 签到失败", "未获取到 formhash，请刷新或点击一次论坛首页。");
  $done();
} else {
  // 修正为飞牛论坛实际使用的经典签到插件路径（dsu_amupper）
  const signUrl = `https://club.fnnas.com/plugin.php?id=dsu_amupper:pper&action=qiandao&infloat=yes&handlekey=qiandao&inajax=1&ajaxtarget=fwin_content_qiandao&formhash=${formhash}`; 

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
    } else {
      if (response.status === 200) {
        console.log("【飞牛论坛】签到返回数据: " + data);
        
        // 针对新接口的返回内容进行关键词匹配
        if (data.includes("今日已签") || data.includes("已经签到") || data.includes("您今天已经")) {
          $notification.post("飞牛论坛签到", "🔁 今日已签到", "您今天已经完成了签到，请勿重复操作。");
        } else if (data.includes("签到成功") || data.includes("恭喜你") || data.includes("📥") || data.includes("succeed")) {
          $notification.post("飞牛论坛签到", "✅ 签到成功", "恭喜，飞牛论坛自动签到成功！");
        } else {
          // 如果依然有别的提示（比如某些特定的 Discuz 弹窗），将其抽离显示在通知中
          const tipMatch = data.match(/<div class="c">([\s\S]*?)<\/div>/);
          const tipText = tipMatch ? tipMatch[1].replace(/<[^>]+>/g, '').trim() : "请检查控制台日志";
          
          if (tipText.includes("成功") || tipText.includes("已")) {
             $notification.post("飞牛论坛签到", "✅ 签到结果", tipText);
          } else {
             $notification.post("飞牛论坛签到", "⚠️ 状态未知", tipText);
          }
        }
      } else {
        $notification.post("飞牛论坛签到", "❌ 签到失败", `服务器返回状态码: ${response.status}`);
      }
    }
    $done();
  });
}
