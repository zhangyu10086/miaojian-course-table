# 微信小程序课程表 · 设计文档

- 日期：2026-10-20
- 状态：待实现
- 参考项目：拾光课程表（Apache-2.0）、shiguang_warehouse（MIT）

## 1. 目标

做一个自用的微信小程序课程表，支持：

1. 从学校新版正方教务系统（jwglxt）自动导入课表。
2. 周视图展示课程，支持左右滑动切周、单双周、课程冲突并排。
3. 手动增删改课程，作为教务数据不准时的兜底。
4. 今日课程 / 下一节课。
5. 课程颜色、备注、学分。

第一版只做体验版自用，不提交审核。

## 2. 非目标

- 不做公开上架、多人共享、班级课表。
- 不做多学校/多教务系统适配，只做新版正方；其他系统留适配层。
- 不做抢课、成绩查询、考试查询。
- 不做长期订阅消息推送（个人主体不具备资格）。

## 3. 技术方案

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | 原生小程序 WXML/WXSS/JS | 无构建链，开发者工具直接运行 |
| 本地存储 | `wx.setStorageSync` | 课程数据量小，离线可用 |
| 教务登录 | 微信云开发云函数 Node.js | 绕过小程序 request 域名白名单，免服务器 |
| 课表解析 | 客户端 JS | 便于单元测试、适配字段变化 |

### 3.1 架构图

```
微信小程序
├─ 课表页（周视图 / 切周 / 详情 / 冲突布局）
├─ 今日页（下一节课 / 今日列表 / 倒计时）
├─ 我的页（导入 / 设置 / 导出 / 清空）
├─ 编辑课程页
├─ 同步页
└─ 设置页
        │ wx.cloud.callFunction('syncSchedule')
        ▼
云函数 syncSchedule
├─ 1. GET  {base}/xtgl/login_slogin.html             取 csrftoken
├─ 2. GET  {base}/xtgl/login_getPublicKey.html       取 modulus/exponent
├─ 3. POST {base}/xtgl/login_slogin.html             RSA(PKCS1) 加密密码
├─ 4. GET  {base}/xtgl/index_initMenu.html           校验登录态
├─ 5. POST {base}/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151
│         body: xnm, xqm, kzlx=ck, xsdm=
└─ 6. 返回 kbList
```

## 4. 数据模型

### 4.1 Course

```js
{
  id: string,
  name: string,
  teacher: string,
  location: string,
  day: number,              // 1=周一 ... 7=周日
  startSection: number,     // 1-based
  endSection: number,
  weeks: number[],          // 展开后的周次，如 [1,3,5,7]
  colorIndex: number,       // 调色板索引
  remark: string,
  credit: number,
  source: 'sync' | 'manual',
  updatedAt: number
}
```

### 4.2 Settings

```js
{
  semesterStartDate: string, // 'YYYY-MM-DD'，第 1 周起始日
  totalWeeks: number,        // 默认 20
  firstDayOfWeek: number,    // 1=周一, 7=周日
  showWeekends: boolean,
  sections: [{ number, startTime: 'HH:MM', endTime: 'HH:MM' }],
  jwBaseUrl: string,
  term: { xnm: string, xqm: '3' | '12' | '16' }
}
```

### 4.3 同步替换规则

- 同步只替换 `source === 'sync'` 的课程。
- `source === 'manual'` 的课程保留。
- 编辑过同步课程后，该课程转为 `manual`，重新同步不会覆盖。

## 5. 页面与交互

### 5.1 课表页（tab）

- 顶部：第 N 周、下拉选择周次、左右箭头、回到本周。
- 表头：周一至周五/周日 + 日期，今天高亮。
- 左侧：节次序号 + 起止时间。
- 主体：按天分列，课程块绝对定位；冲突课程按列并排。
- 左右滑动切周。
- 点击课程块打开详情底部弹层：编辑、删除。
- 点击空白格子：跳转添加课程，预填星期和节次。
- 空状态：手动添加 / 从教务导入。
- 未设置学期：顶部提示去设置。

### 5.2 今日页（tab）

- 日期、第几周、星期。
- 下一节课卡片：课程名、时间、地点、倒计时。
- 今日课程列表：已结束 / 进行中 / 即将开始。
- 无课状态。
- 每 30 秒刷新倒计时。

### 5.3 我的页（tab）

- 课表统计：课程数、当前周、学期。
- 从教务系统导入。
- 手动添加课程。
- 学期与节次设置。
- 导出课表 JSON 到剪贴板。
- 清空课表。
- 关于与开源署名。

### 5.4 编辑课程页

- 课程名、教师、地点。
- 星期、开始节次、结束节次。
- 周次选择：1..总周数，支持全选/单周/双周/清空。
- 颜色选择。
- 备注、学分。
- 保存 / 删除。
- 编辑同步课程后 `source` 变为 `manual`。

### 5.5 同步页

- 教务系统地址（如 `https://jw.example.edu.cn`）。
- 学号、密码。
- 学年（起始年份）、学期（第一/第二/短学期）。
- 记住密码开关（默认关）。
- 导入按钮 + 安全说明。
- 结果显示：解析到 N 门课，确认后替换同步课程。

### 5.6 设置页

- 学期开始日期。
- 总周数（10–30）。
- 每周起始日（周一/周日）。
- 显示周末。
- 节次时间编辑（增删、修改起止时间、恢复默认）。
- 提醒提前分钟。

## 6. 正方同步协议

### 6.1 登录

1. `GET {base}/xtgl/login_slogin.html`
   - 从 HTML 隐藏域或 Cookie 取 `csrftoken`。
2. `GET {base}/xtgl/login_getPublicKey.html?time={ts}`
   - 返回 `{ modulus, exponent }`（Base64）。
3. 用 Node `crypto` 构造 RSA 公钥，PKCS#1 v1.5 填充加密密码：
   ```js
   const key = crypto.createPublicKey({
     key: { kty: 'RSA', n: base64url(modulus), e: base64url(exponent) },
     format: 'jwk'
   })
   const mm = crypto.publicEncrypt(
     { key, padding: crypto.constants.RSA_PKCS1_PADDING },
     Buffer.from(password)
   ).toString('base64')
   ```
4. `POST {base}/xtgl/login_slogin.html`
   - form: `csrftoken`, `yhm`（学号）, `mm`（密文）, `language=zh_CN`
   - 手动跟随 302，Cookie Jar 保存 `JSESSIONID`。

### 6.2 课表

`POST {base}/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151`

- Headers:
  - `Content-Type: application/x-www-form-urlencoded`
  - `X-Requested-With: XMLHttpRequest`
  - `Referer: {base}/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default`
- Body:
  - `xnm`：学年起始年，如 `2026`
  - `xqm`：`3` 第一学期 / `12` 第二学期 / `16` 短学期
  - `kzlx=ck`
  - `xsdm=`
- 返回 JSON 的 `kbList`。

### 6.3 字段解析

| 字段 | 含义 | 处理 |
|---|---|---|
| `kcmc` | 课程名 | 去空白 |
| `xm` | 教师 | 去空白 |
| `cdmc` | 地点 | 去空白，取最后一段 |
| `xqj` | 星期 | `parseInt` |
| `jcs` / `jc` | 节次 | `1-2节` → `[1,2]`，逗号分隔的多段拆成多门课 |
| `zcd` | 周次 | `1-16周(单)` → 展开并过滤单双周 |

### 6.4 错误码

- `LOGIN_FAILED`：账号密码错误或登录页结构变化。
- `CAPTCHA_REQUIRED`：出现验证码/滑块，需手动处理。
- `NETWORK_ERROR`：教务系统不可达。
- `PARSE_ERROR`：返回内容不是预期 JSON。
- `NO_COURSES`：该学期无课或学期参数错误。
- `HOST_NOT_ALLOWED`：域名不在 `ALLOWED_HOSTS` 中。

### 6.5 会话过期检测

正方过期时常返回 HTTP 200 + 登录页 HTML，而不是 401。检测返回内容中是否包含登录表单特征（`login_slogin`、`yhm`、`csrftoken`），命中则返回 `LOGIN_FAILED`。

## 7. 周次与布局

### 7.1 当前周

- 第 1 周起始日 = `semesterStartDate` 所在周的 `firstDayOfWeek`。
- 当前周 = `floor((本周起始日 - 第1周起始日) / 7) + 1`，限制在 1..totalWeeks。

### 7.2 课程块布局

1. 过滤 `weeks.includes(currentWeek)` 且 `day` 匹配的课程。
2. 按 `startSection` 升序、时长降序排序。
3. 区间重叠的课程聚成一个 cluster。
4. cluster 内按列分配：优先放入已结束的列，否则新开一列。
5. 输出 `top/height/left/width`，绝对定位。

## 9. 安全与合规

- 密码默认不落盘；勾选记住密码仅存本机 Storage。
- 云函数不打印、不存储密码；仅在一次调用内使用。
- 云函数通过 `ALLOWED_HOSTS` 限制目标域名，避免 SSRF/代理滥用。
- 仅体验版自用，不公开上架。
- 公开上架前需重新评估：个人主体、教育类目、教务数据授权、学校名称/商标。
- 保留拾光课程表（Apache-2.0）与 shiguang_warehouse（MIT）的署名及许可证副本。

## 10. 测试

- 单元测试（Node `node:test`）：
  - `parseWeeks`：普通周、单双周、逗号分隔、中文括号。
  - `parseSectionRanges`：单节、连续、多段。
  - `parseKbList`：真实字段样例、去重、合并周次。
  - `getWeekNumber`：学期前、学期中、学期后。
  - `buildBlocks`：无冲突、两课冲突、三课冲突。
- 手工测试：
  - 开发者工具模拟器。
  - 真机预览（体验版）。
  - 真实正方账号同步一次（用户自行输入）。

## 11. 里程碑

1. 项目骨架、本地存储、课表周视图、手动增删改、今日/下一节。
2. 设置页、周次计算。
3. 同步页、云函数、正方登录与解析。
4. 单元测试、README、真机验证。

## 12. 待确认

- 用户学校的教务系统域名（同步页可填，无需提供账号密码）。
- 学校正方是否启用验证码/滑块；若启用，自动同步需降级为手动导入。
