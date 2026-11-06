// 版本 v1.1
function operator(proxies) {
  const hop = '🇭🇰 hks1-v4'
  return proxies.map(p => {
    p['underlying-proxy'] = hop
    return p
  })
}
