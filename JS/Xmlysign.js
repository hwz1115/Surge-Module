/*
喜马拉雅签到脚本

更新时间: 2023-11-03
脚本兼容: Surge
脚本作者: MartinsKing
软件功能: 喜马拉雅每日签到
注意事项:
  抓取cookie时注意保证账号登录状态；
使用声明: ⚠️此脚本仅供学习与交流, 请勿贩卖！⚠️
脚本参考: yml2213、chavyleung
使用说明：
    获取cookie
        后台退出手机喜马拉雅客户端的情况下,重新打开APP进入主页
        如通知成功获取cookie,则可以使用此签到脚本.
        获取Cookie后, 请将Cookie脚本禁用并移除主机名,以免产生不必要的MITM.
        脚本将在每天上午8点35执行,您可以修改执行时间.
/***********************
Surge 远程脚本配置:
************************

[Script]
喜马拉雅签到任务 = type=cron,cronexp=35 8 * * *,script-path=https://raw.githubusercontent.com/ClydeTime/Surge/main/Script/Task/xmly.js,timeout=15,wake-system=1

# 喜马拉雅获取Cookie
「请在模块中添加,成功获取cookie后模块应去除勾选」
https://raw.githubusercontent.com/ClydeTime/Surge/main/Task/GetCookie.sgmodule

*/

const format = (ts, fmt = 'yyyy-MM-dd HH:mm:ss') => {
  return $.time(fmt, ts)
}

const $ = new Env('喜马拉雅')
const name = 'xmly'
const zh_name = "喜马拉雅"
const startTime = $.time('yyyy-MM-dd HH:mm:ss')
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
        $.setdata("", name + "_watch")
        $.setdata("", name + "_spec")
        //$.setdata("", name + "_gene")
        $.msg(zh_name, "", "- 喜马拉雅获取cookie成功")
    }
}

async function main() {
    config.headers = $.getjson(name + "_headers", {})
    config.xm_cookie = `${typeof config['headers']['Cookie']=='undefined' ? config['headers']['cookie'] : config['headers']['Cookie']}`
    let sign_flag = await xmlySign()

    if (sign_flag) {
        let message = `🟢【恭喜】签到状态:签到成功`
        $.msg(zh_name, "", message)
    } else {
        let message = `🔴【抱歉】签到状态:签到失败 \n` + "请重新获取cookie"
        $.log(message)
        $.msg(zh_name, "", message)
    }
}

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

/***************** Env *****************/
