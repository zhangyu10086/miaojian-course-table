# 贡献指南

感谢你愿意参与「秒见课表」。提交前请先读一遍本文件。

## 可以贡献什么

| 类型 | 说明 |
|---|---|
| 学校适配 | 反馈某所学校能否自动导入，或补充学校信息 |
| Bug 修复 | 崩溃、布局错乱、导入失败等 |
| 功能建议 | 先在 Discussions 里讨论，再提 PR |
| 文档 | 修正错别字、补充使用说明 |
| 测试 | 补充单元测试、真机验证记录 |

> 请不要提交任何真实的学号、密码、教务账号截图。

## 开发环境

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版）。
2. 克隆仓库后，复制配置模板：
   ```bash
   cp miniprogram/config.example.js miniprogram/config.js
   ```
   在 `config.js` 里填入自己的云开发环境 ID。**该文件已被 `.gitignore` 忽略，不要提交。**
3. 用自己的 AppID 打开项目（`project.private.config.json` 会被自动生成本地配置，也不会被提交）。
4. 运行测试：
   ```bash
   npm ci
   npm ci --prefix cloudfunctions/syncSchedule
   npm test
   npm run audit
   ```

## 代码约定

- 语言：JavaScript（CommonJS），不使用构建工具。
- 缩进：2 空格；字符串优先单引号。
- 命名：变量和函数用 `camelCase`，常量用 `UPPER_SNAKE_CASE`。
- 注释：中文，解释「为什么」而不是「做了什么」。
- 页面逻辑放在 `miniprogram/pages/<page>/<page>.js`，可复用的纯函数放在 `miniprogram/utils/`。
- 纯逻辑必须可被 Node 直接 `require`，方便单元测试。
- 修改 UI 后请在开发者工具和真机各验证一次。

## 提交信息

使用简单的约定式提交：

```
feat: 新增 ICS 导出
fix: 修复第 1 周边界无法回弹
docs: 补充学校适配说明
test: 补充周次解析用例
```

## 学校适配

新增学校不需要发版，管理员在云数据库维护即可。普通贡献者可以：

1. 用「学校适配」Issue 模板提交学校名和教务地址。
2. 或运行检测脚本：
   ```bash
   node scripts/check-school.js "学校名称" "https://jw.example.edu.cn"
   ```
3. 把结果贴到 Issue 里，并说明是否有验证码、滑块、SSO。

> 只验证「页面能否访问、是否为正方」，不要尝试登录他人账号。

## 提交 PR

1. Fork 仓库，从 `main` 建分支：`feat/xxx` 或 `fix/xxx`。
2. 保证 `npm test` 和 `npm run audit` 通过。
3. PR 描述里写清楚：改了什么、为什么改、怎么验证的。
4. 涉及 UI 的请附截图或录屏。
5. 不要在一个 PR 里混入无关改动。

## 代码行为

- 尊重其他贡献者，讨论对事不对人。
- 不提交广告、与项目无关的内容。
- 不绕过管理员校验、不引入收集用户账号密码的代码。
- 发现安全问题时不要开公开 Issue，见 [SECURITY.md](SECURITY.md)。

## 许可证

提交的代码默认以 [MIT](LICENSE) 许可证授权。引用第三方代码时请注明来源和许可证。
