/*
喜马拉雅签到脚本

更新时间: 2026-07-08
脚本兼容: Surge
脚本作者: MartinsKing (由 AI 精简并内置去广告)
软件功能: 喜马拉雅每日签到 + 去广告
注意事项:
  抓取cookie时注意保证账号登录状态；
使用说明：
    获取cookie
        后台退出手机喜马拉雅客户端的情况下,重新打开APP进入主页
        如通知成功获取cookie,则可以使用此签到脚本.
        获取Cookie后, 请将Cookie脚本禁用并移除主机名,以免产生不必要的MITM.
        脚本将在每天上午8点35执行,您可以修改执行时间.

/***********************
Surge 远程脚本配置（直接放进你的 Surge 配置文件中）:
************************

[Script]
# 1. 定时自动签到
喜马拉雅签到任务 = type=cron,cronexp=35 8 * * *,script-path=https://raw.githubusercontent.com/ClydeTime/Surge/main/Script/Task/xmly.js,timeout=15,wake-system=1

https://ahrefs.com/writing-tools/paragraph-rewriter
# 2. 内置去广告规则（长期有效）
^https?:\/\/adse\.ximalaya\.com\/dataplus\/buildings - reject
^https?:\/\/adse\.wsa\.ximalaya\.com\/ad\/v\d\/openapi - reject
^https?:\/\/adse\.ximalaya\.com\/ad\/v\d\/realtime - reject
^https?:\/\/adse\.ximalaya\.com\/ad\/v\d\/sound\/patch - reject

*/

const format = (ts, fmt = 'yyyy-MM-dd HH:mm:ss') => {
  return $.time(fmt, ts)
}

const $ = new Env('喜马拉雅')
const name = 'xmly'
const zh_name = "喜马拉雅"
const config = {
  cookie: {},
  headers: {}
}

!(async () => {
    if (typeof $request != "undefined") {
        $.log("- 正在获取cookie, 请稍后")
        getCookie()
    } else { 
       await main()
    }
})()
	.catch((e) => $.logErr(e))
	.finally(() => $.done())

function getCookie() {
    if ("object" == typeof $request) {
        const headers = JSON.stringify($request.headers)
        if (headers) $.setdata(headers, name + "_headers")
        $.msg(zh_name, "", "- 喜马拉雅获取cookie成功")
    }
}

async function main() {
    config.headers = $.getjson(name + "_headers", {})
    config.xm_cookie = `${typeof config['headers']['Cookie']=='undefined' ? config['headers']['cookie'] : config['headers']['Cookie']}`
    
    // 执行原汁原味的原生签到函数
    let sign_flag = await xmlySign()
    
    if (sign_flag) {
        let message = `🟢【恭喜】签到状态:签到成功 \n`
        $.msg(zh_name, "", message)
    } else {
        let message = `🔴【抱歉】签到状态:签到失败 \n` + "请重新获取cookie"
        $.log(message)
        $.msg(zh_name, "", message)
    }
}

// 保留完全未动的原版签到函数，确保接口绝对原装
async function xmlySign(){
    $.log("### 签到任务进行中")
    let headers = {
        "Cookie": config.xm_cookie,
        "Content-Type": "application/json"
    }
    let body = `{"aid":87}`
    let myRequest = {
        url: "http://hybrid.ximalaya.com/web-activity/signIn/v2/signIn?v=new",
        headers: headers,
        body: body
    }
    return await $.http.post(myRequest).then(
       (response) => {
            body = JSON.parse(response.body)
            if (body.ret == 0) {
                $.log("- 签到成功")
                return true
            } else {
                $.log("- 签到失败")
                $.log("- 请重新获取cookie")
                return false
            }
        },(reason) => {
            $.log("- 签到失败")
            return false
        }
    )
}

/***************** Env 环境库 (已补全截断) *****************/
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,n]=i.split("@"),a={url:`http://${n}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),n=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(n);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:n}=t,a=s.decode(n,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:n,body:a},a)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got.post(t).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:n}=t,a=s.decode(n,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:n,body:a},a)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}msg(e=this.name,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isSurge()?t:this.isQuanX()?{"open-url":t}:this.isLoon()?{openUrl:t}:void 0;if("object"==typeof t){if(this.isSurge()){let e=t.openUrl||t["open-url"]||t.url||t["media-url"];return e?{url:e}:void 0}if(this.isQuanX()){let e=t["open-url"]||t.openUrl||t.url;let s=t["media-url"]||t.mediaUrl;return e||s?{"open-url":e,"media-url":s}:void 0}if(this.isLoon()){let e=t.openUrl||t["open-url"]||t.url;let s=t.mediaUrl||t["media-url"];return e?{openUrl:e,mediaUrl:s}:void 0}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),this.log(t.join("\n"))}}gettime(){return new Date}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1000;this.log("",`🔔${this.name}, 结束! 🕛 耗时 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}({})}
