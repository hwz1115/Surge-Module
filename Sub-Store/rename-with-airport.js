/**
 * 自定义节点重命名脚本（优化版 v2）
 * 用法：Sub-Store 脚本操作，直接粘贴此脚本链接即可，无需任何参数
 *
 * 最终节点名格式：
 *   国旗 地区名编号 倍率(如果不是1倍) | 机场名
 *   例：🇭🇰 香港01 3x | hkvps
 *   例：🇭🇰 香港01 | hkvps        （没有倍率信息或就是1倍，不显示倍率）
 *   例：🇹🇼 台湾01 | hkvps
 *   例：🇹🇼 TW01 | hkvps           （原名精确写"TW"缩写时，保留TW文字 + 台湾旗）
 *
 * 规则说明：
 * 1. 地区识别：中文名/国旗emoji/英文全称/英文缩写，四选一命中即可（已支持大小写不敏感）
 * 2. 台湾特例：原名含 TW / TW01 / TW-1 等缩写（且不含"台湾"/"Taiwan"/🇹🇼）→ 保留"TW"文字 + 🇹🇼国旗
 *    原名写"台湾"或已带🇹🇼 → 正常使用🇹🇼 台湾xx
 * 3. 倍率：自动识别"3倍"/"×3"/"3x"等写法，统一转成"3x"；1倍或没有倍率信息则不显示
 * 4. 编号：按"地区+机场"分组各自独立编号（不同机场的香港节点都能从01开始）
 * 5. 机场名：自动读取节点所属订阅名（优先用订阅的显示名称），放在最后用 | 分隔
 * 6. 认不出地区的节点：保持原名不动，不会被删除
 * 7. 匹配前自动清理常见协议前缀（HY2/Hysteria2/tuic/VLESS/VMess等），提高识别率
 * 8. 自动去除到期、套餐、流量、重置、官网、公告等非节点信息
 *
 * 针对截图中类似节点的处理示例：
 *   "hysteria2 sg 新加坡07 | MITCE" → 🇸🇬 新加坡01 | MITCE
 *   "SG2-HY2"                     → 🇸🇬 新加坡02 | MITCE
 *   "tuic TW01 | MITCE"           → 🇹🇼 TW01 | MITCE
 *   "TW-1"                        → 🇹🇼 TW02 | MITCE
 */

// prettier-ignore
const ZH = ['香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋','阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时','伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪','柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)','哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚','爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚','圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列','意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托','利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来','马尔代夫','马里','马耳他','毛利塔尼亚','毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰','新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾','葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克','斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦','坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭','乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登','库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'];
// prettier-ignore
const FG = ['🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪','🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷','🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭','🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰','🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯','🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾','🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮','🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱'];
// prettier-ignore
const QC = ['Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai','Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi','Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa','CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia','Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan','Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins','Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'];
// prettier-ignore
const EN = ['HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE','AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD','CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER','EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS','LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR','MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH','PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK','SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ','TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY','UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI','CW','SC','AQ','GI','CU','FO','AX','BM','TL'];

// 倍率识别正则
const multiplierRegex = /((倍率|X|x|×)\D?((\d{1,3}\.)?\d+)\D?)|((\d{1,3}\.)?\d+)(倍|X|x|×)/;

// 常见协议/类型前缀，匹配前先去掉（大小写不敏感）
const protocolClean = /\b(HY2|Hysteria2?|Hysteria|tuic|TUIC|VLESS|VMess|Trojan|SS|SSR|Shadowsocks|WireGuard|WG|AnyTLS|Reality|gRPC|WS|HTTP|HTTPS|TCP|UDP|QUIC)\b/gi;

function operator(proxies) {
  // 建立"关键词 → 中文地区名"对照表，优先级：中文 > 国旗 > 英文全称 > 英文缩写
  const regionMap = {};
  [ZH, FG, QC, EN].forEach((list) => {
    list.forEach((val, idx) => {
      if (!(val in regionMap)) regionMap[val] = ZH[idx];
    });
  });

  // 先过滤掉到期、套餐、流量、公告、建议等非节点信息
  const infoKeywords = /到期|剩余|套餐|流量|重置|官网|电报|频道|通知|公告|过期|有效期|距离下次|建议|卡顿|专线|expire|traffic|remain|reset|official|telegram|channel|notice|announcement|package|plan|quota|unused|used|total/i;
  proxies = proxies.filter((proxy) => {
    const name = proxy.name || '';
    if (name.length < 2) return false;
    return !infoKeywords.test(name);
  });

  const counters = {}; // 记录每个"地区+机场"组合当前编到几号

  proxies.forEach((proxy) => {
    const originalName = proxy.name || '';
    // 机场名：优先用订阅显示名称，没有就用订阅原始名称
    const subLabel = proxy._subDisplayName || proxy._subName || '';

    // 清理协议前缀后再匹配地区
    const cleanName = originalName.replace(protocolClean, ' ').replace(/\s+/g, ' ').trim();
    const cleanNameLower = cleanName.toLowerCase();

    // 1. 台湾特例：原名含 TW / TW01 / TW-1 等缩写（且不含"台湾"/"Taiwan"/🇹🇼）→ 保留 TW 文字 + 🇹🇼
    // 注意：\bTW\b 匹配不到 "TW01"（数字紧跟），所以用更宽松的匹配
    const isTWAbbr =
      /(?:^|[^a-z0-9])tw(?:[^a-z]|$|\d)/i.test(cleanName) &&
      !/台湾|taiwan/i.test(cleanName) &&
      !cleanName.includes('🇹🇼');

    let regionZh = '';
    let flag = '';

    if (isTWAbbr) {
      regionZh = 'TW';
      flag = '🇹🇼';  // 纯 TW 缩写也显示台湾旗
    } else {
      // 大小写不敏感匹配
      const matchedKey = Object.keys(regionMap).find((key) =>
        cleanNameLower.includes(key.toLowerCase())
      );
      if (!matchedKey) {
        // 认不出地区：保持原名不动，跳过这个节点
        return;
      }
      regionZh = regionMap[matchedKey];
      flag = FG[ZH.indexOf(regionZh)] || '';
      // 正常使用 🇹🇼（不再强制 🇨🇳）
    }

    // 2. 提取倍率，非1倍才保留
    let multiplier = '';
    const match = originalName.match(multiplierRegex);
    if (match) {
      const num = match[0].match(/(\d[\d.]*)/)?.[0];
      if (num && parseFloat(num) !== 1) {
        multiplier = num + 'x';
      }
    }

    // 3. 按"地区+机场"分组独立编号
    const groupKey = regionZh + '@' + subLabel;
    counters[groupKey] = (counters[groupKey] || 0) + 1;
    const seq = String(counters[groupKey]).padStart(2, '0');

    // 4. 拼接最终名字：国旗 地区编号 倍率 | 机场名
    const parts = [flag, regionZh + seq];
    if (multiplier) parts.push(multiplier);
    let newName = parts.filter(Boolean).join(' ');
    if (subLabel) newName += ' | ' + subLabel;

    proxy.name = newName;
  });

  return proxies;
}
