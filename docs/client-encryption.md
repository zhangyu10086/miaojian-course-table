# 手机端密码加密说明

## 目标

让云函数**看不到用户明文密码**。

## 关键发现：正方公钥按会话生成

2026-10 在示例学校实测发现，新版正方 `login_getPublicKey.html` 每次请求都会返回**不同**的 `modulus`，同一个 `JSESSIONID` 里连续请求两次也会轮换，学校只保留最新的一对密钥。

这意味着：

- 手机端自己 `wx.request` 取公钥，会创建**另一个会话**（另一个 `JSESSIONID`）
- 云函数登录时用的是它自己的会话，学校用**云函数会话里的私钥**解密
- 密文和私钥不匹配，登录必然失败，表现为「账号或密码错误」

线上 1.2.0 的示例学校导入失败就是这个原因。公钥本身没有错，错的是「取公钥的会话」和「登录的会话」不是同一个。

## 第二个坑：modulus 带 Java 前导零

同一次排查还发现，示例学校的公钥是 **1024 位**，接口返回的 `modulus` 是 **129 字节**，第一个字节是 `0x00`（Java `BigInteger.toByteArray()` 的符号字节）。

手机端最初把这个前导零也算进了密钥长度：

- 填充长度按 129 字节算，比正确的 128 字节多了一个字节
- RSA 加密本身能算出来，学校也能解密，但解出来的 PKCS#1 块整体错位
- 学校拿到的明文不是密码，于是同样提示「用户名或密码不正确」

浏览器提交的密文是 **128 字节**，我们生成的是 **129 字节**，这就是当时唯一的差别。对照真实浏览器抓包可以确认。

修复方式（`miniprogram/utils/rsa.js`）：

```js
function modulusBytesOf(modulusB64) {
  const bytes = base64ToBytes(modulusB64)
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1
  return bytes.slice(start)
}
```

计算 `keyLength` 和填充长度时使用去掉前导零后的字节数组，密文长度与学校期望一致。已补两个测试：1024 位带前导零、2048 位带前导零，均能用私钥解出原密码。

## 现在的流程

```
① 手机 → 云函数 { action: 'prepare' }
   云函数新建一个会话：
     GET  登录页        → 拿 csrftoken + Set-Cookie
     GET  公钥接口      → 同一个会话里拿最新公钥
   返回 { token, modulus, exponent }
   token 里是这条会话的 Cookie + csrftoken，5 分钟过期

② 手机用 modulus/exponent 在本地 RSA 加密密码

③ 手机 → 云函数 { token, username, encryptedPassword, xnm, xqm }
   云函数恢复 token 里的会话，用同一个 csrftoken 提交登录
   登录成功后继续请求课表接口
```

整个过程中：

- 明文密码只存在于手机内存和学校服务器之间（传输时是密文）
- 云函数只拿到学号、密文、token
- token 里没有密码，也不写入数据库、不写日志

## 为什么把会话打包进 token

小程序拿不到学校的 `Set-Cookie`，也没法给 `wx.request` 手动设置 Cookie，客户端无法自己维持教务会话；云函数又可能在不同实例间切换，不能把会话放内存。

所以把「登录前」的会话（Cookie + csrftoken）打包成 token 交给手机，手机加密完再带回来，是最稳妥的无状态方案。

安全性：

- 这个会话在登录成功前没有任何权限，token 泄露也只能重复一次「还没成功的登录」
- token 5 分钟过期，绑定当前 openid 和学校地址
- 每次导入都会新建会话，不复用旧 token

## 安全边界

解决的是：

- 云函数不接触明文密码
- 密码在手机上完成加密
- 云函数不持久化账号、密码和会话

仍然存在：

- 云函数会向手机下发学校公钥。如果云函数被篡改，理论上可以换成攻击者自己的公钥再解密。这是「服务端中转公钥」方案的固有限制；开发者控制客户端代码，本来就需要用户信任开发者
- 学校公钥接口本身被劫持，属于 HTTPS 信任问题
- 云函数能看到学号和密文

## 学校白名单

1.3.0 起，「是否开放自动导入」以云数据库 `schools.autoImport` 为准，`miniprogram/utils/secure-import.js` 只作为旧数据和离线时的兜底：

- `autoImport: true`：显示「安全导入」
- `autoImport: false`：显示「仅手动」，云函数也会拒绝
- 字段缺失：回退到 `SECURE_IMPORT_HOSTS` 本地白名单

新增学校通过「我的 → 长按隐私说明与开源声明 → 学校管理」操作，只写数据库，不需要改代码或发版。详见 `docs/school-admin.md`。

公钥和登录都由云函数完成，云函数不受小程序 request 域名白名单限制。

内置兜底名单里的 12 所：

- 示例学校：`jwglxt.wuit.cn`（已实测）
- 新疆农业大学：`jwxt.xjau.edu.cn`
- 无锡学院：`jwgl.cwxu.edu.cn`
- 甘肃医学院：`jw.gsmc.edu.cn`
- 河南工业大学：`jwglxt.haut.edu.cn`
- 聊城大学东昌学院：`jw.lcudcc.edu.cn`
- 南通大学：`tdjw.ntu.edu.cn`
- 青岛理工大学：`jxgl.qut.edu.cn`
- 西南林业大学：`jw.swfu.edu.cn`
- 文华学院：`jw1.hustwenhua.net`
- 许昌学院：`jwglxt.xcu.edu.cn`
- 浙江中医药大学：`jwmk.zcmu.edu.cn`

除示例学校外，其余学校还没有用真实账号完整导入过。有同学导入成功后，`syncSchedule` 会自动把 `verified` 标成 `true`。

## 部署顺序（重要）

1. 先部署新版 `syncSchedule` 云函数
   - 支持 `action: 'prepare'` 两步式流程
   - 同时兼容 1.2.0 旧客户端的一步式请求
2. 1.3.0 还需要部署 `manageSchool`、重新部署 `listSchools`，并给 `manageSchool` 配置 `ADMIN_OPENIDS`
3. 再上传新版小程序
4. 旧版 1.2.0 对「按会话轮换公钥」的学校（如示例学校）仍会失败，用户升级后恢复

开启 `REQUIRE_CLIENT_ENCRYPT=true` 后，云函数会拒绝没有密文的请求，彻底不再接收明文密码。开启前确认旧版本用户已基本升级。

## 实现位置

- `cloudfunctions/syncSchedule/index.js`
  - `prepareLogin`：建会话、拿 csrftoken、取公钥
  - `handlePrepare`：生成 token
  - `decodeSessionToken` / `restoreCookies`：第二步恢复会话
- `miniprogram/utils/cloud.js`：`prepareSync`
- `miniprogram/utils/rsa.js`：RSA PKCS#1 v1.5 加密（BigInt + 安全随机数）
- `miniprogram/pages/sync/sync.js`：prepare → 加密 → 登录；`SESSION_EXPIRED` 自动重建一次会话

## 失败时怎么办

以下情况都会中止导入，并提示手动添加课程，不会发送明文密码：

- 学校不在白名单
- 云函数连不上学校（校园网/VPN 限制）
- 登录页没有 csrftoken（学校定制）
- 需要验证码/滑块
- 手机不支持 BigInt 或安全随机数
- RSA 加密失败

## 测试清单

- 示例学校：用真实账号导入成功（关键回归项，2026-10-27 已验证 15 门课）
- 新疆农业大学：导入成功
- 密文长度：1024 位密钥应为 **128 字节**（base64 172 字符），2048 位为 256 字节
- 旧版 1.2.0 客户端：未开启 `REQUIRE_CLIENT_ENCRYPT` 时仍能走旧流程
- 开启 `REQUIRE_CLIENT_ENCRYPT` 后：没有密文的请求被拒绝
- iOS / Android 各测一次 BigInt 和随机数

> 注意：用不存在的账号测试时，学校也会返回「账号或密码错误」。这只说明学校尝试了解密，**不能证明解出来的明文正确**。判断加密是否正确，必须用真实账号成功导入。
