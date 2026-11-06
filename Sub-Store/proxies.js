// 版本 v1.1
function operator(proxies) {
  const hop = '🇭🇰 akile-hk'
  return proxies.map(p => {
    p['underlying-proxy'] = hop
    return p
  })
}
