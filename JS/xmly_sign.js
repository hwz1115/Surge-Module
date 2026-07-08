/*
喜马拉雅纯净签到脚本
更新时间: 2026-07-08
*/

const $ = new Env('喜马拉雅签到');
const name = 'xmly';
const zh_name = "喜马拉雅";

config = { headers: {} };

!(async () => {
    if (typeof $request != "undefined") {
        getCookie();
    } else { 
       await main();
    }
})()
.catch((e) => $.logErr(e))
.finally(() => $.done());

function getCookie() {
    if ("object" == typeof $request) {
        const headers = JSON.stringify($request.headers);
        if (headers) {
            $.setdata(headers, name + "_headers");
            $.msg(zh_name, "", "🎉 成功获取签到 Cookie，请去模块中关闭获取功能。");
        }
    }
}

async function main() {
    config.headers = $.getjson(name + "_headers", {});
    config.xm_cookie = `${typeof config['headers']['Cookie']=='undefined' ? config['headers']['cookie'] : config['headers']['Cookie']}`;
    
    if (!config.xm_cookie || config.xm_cookie === "undefined") {
        $.msg(zh_name, "❌ 签到失败", "未检测到有效 Cookie，请先打开 APP 获取。");
        return;
    }

    $.log("### 自动签到任务开始...");
    let headers = {
        "Cookie": config.xm_cookie,
        "Content-Type": "application/json",
        "User-Agent": config.headers["User-Agent"] || config.headers["user-agent"] || "Mozilla/5.0"
    };
    let body = `{"aid":87}`;
    let myRequest = {
        url: "http://hybrid.ximalaya.com/web-activity/signIn/v2/signIn?v=new",
        headers: headers,
        body: body
    };

    return await $.http.post(myRequest).then(
       (response) => {
            let resBody = JSON.parse(response.body);
            if (resBody.ret == 0) {
                $.log("🟢 喜马拉雅签到成功！");
                $.msg(zh_name, "✅ 签到成功", "今天也要开心听书哦！");
            } else {
                $.log(`🔴 签到失败，原因: ${resBody.msg || '未知'}`);
                $.msg(zh_name, "❌ 签到失败", `原因: ${resBody.msg || 'Cookie可能已过期'}`);
            }
        },() => {
            $.log("🔴 签到接口请求失败");
            $.msg(zh_name, "❌ 签到失败", "网络请求异常");
        }
    );
}

/***************** Env 最简版环境库 *****************/
function Env(t,e){return new class{constructor(t,e){this.name=t,this.startTime=(new Date).getTime()}isSurge(){return"undefined"!=typeof $httpClient}getdata(t){return $persistentStore.read(t)}setdata(t,e){return $persistentStore.write(t,e)}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(i)}catch{}return s}log(...t){console.log(t.join("\n"))}logErr(t){console.log(`❗️${this.name}错误: ` + t)}msg(t,e,s){$notification.post(t,e,s)}done(t={}){$done(t)}}({})}
