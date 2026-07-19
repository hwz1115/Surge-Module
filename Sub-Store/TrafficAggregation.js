/**
 * Sub-Store 流量聚合脚本
 * 作用：累加组合订阅中所有机场的流量信息
 */
async function operator(proxies, targetPlatform, context) {
  const { source } = context;
  let total_u = 0;
  let total_d = 0;
  let total_t = 0;
  let min_expire = 0;

  // 1. 遍历当前组合订阅包含的所有订阅源
  for (const [key, sub] of Object.entries(source)) {
    // 过滤掉非订阅对象（以下划线开头的私有字段）
    if (key.startsWith('_')) continue;

    // 2. 获取该订阅的流量信息 (Sub-Store 已自动解析并存储在 userInfo 中)
    const info = sub.userInfo;
    if (info) {
      total_u += (info.upload || 0);
      total_d += (info.download || 0);
      total_t += (info.total || 0);
      
      // 过期时间通常取最早的那一个，以防断连
      if (info.expire) {
        if (min_expire === 0 || info.expire < min_expire) {
          min_expire = info.expire;
        }
      }
    }
  }

  // 3. 将聚合后的流量信息写入 $options._res.headers
  // 这样客户端（如 Clash/Surge）在刷新订阅时就能看到总流量
  if (total_t > 0) {
    const userinfo = `upload=${total_u}; download=${total_d}; total=${total_t}; expire=${min_expire}`;
    
    // 初始化响应头对象
    if (!$options._res) $options._res = { headers: {} };
    if (!$options._res.headers) $options._res.headers = {};
    
    // 注入聚合后的流量头
    $options._res.headers['subscription-userinfo'] = userinfo;
    
    // 在控制台输出结果便于调试
    console.log(`聚合流量成功: ${userinfo}`);
  }

  return proxies;
}
