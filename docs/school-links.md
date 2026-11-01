# 学校教务登录地址清单

> 由 `docs/schools-seed.json`、`docs/schools-batch.json`、`docs/schools-xjau.json` 和 `miniprogram/utils/secure-import.js` 生成。
> 运行时以云数据库 `schools` 集合为准；`verified` 会在真实导入成功后自动更新。

## 已开放自动导入（12 所）

| 学校 | 登录地址 | 文件内 verified |
|---|---|---|
| 武昌工学院 | https://jwglxt.wuit.cn/jwglxt/xtgl/login_slogin.html | 是 |
| 新疆农业大学 | https://jwxt.xjau.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 无锡学院 | https://jwgl.cwxu.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 甘肃医学院 | https://jw.gsmc.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 河南工业大学 | https://jwglxt.haut.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 聊城大学东昌学院 | https://jw.lcudcc.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 南通大学 | https://tdjw.ntu.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 青岛理工大学 | https://jxgl.qut.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 西南林业大学 | https://jw.swfu.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 文华学院 | https://jw1.hustwenhua.net/jwglxt/xtgl/login_slogin.html | 否 |
| 许昌学院 | https://jwglxt.xcu.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |
| 浙江中医药大学 | https://jwmk.zcmu.edu.cn/jwglxt/xtgl/login_slogin.html | 否 |

## 学校库里的其他候选

这些学校已在批量数据里，但不在客户端内置白名单中。1.3.0 起需要在「学校管理」里打开「开放自动导入」才会显示「安全导入」；否则用户看到的是「仅手动」。

| 学校 | 登录地址 | 域名 |
|---|---|---|
| 宁波工程学院 | http://jwxt.nbut.edu.cn/jwglxt/xtgl/login_slogin.html | jwxt.nbut.edu.cn |
| 山东华宇工学院 | http://jwgl.huayu.edu.cn/jwglxt/xtgl/login_slogin.html | jwgl.huayu.edu.cn |
| 山东师范大学 | http://jwxt.sdnu.edu.cn/jwglxt/xtgl/login_slogin.html | jwxt.sdnu.edu.cn |
| 广州航海学院 | http://jwx.gzmtu.edu.cn/jwglxt/xtgl/login_slogin.html | jwx.gzmtu.edu.cn |
| 徐州工程学院 | http://jwglxt.xzit.edu.cn/jwglxt/xtgl/login_slogin.html | jwglxt.xzit.edu.cn |
| 河南城建学院 | http://jwglxt.huuc.edu.cn:8061/jwglxt/xtgl/login_slogin.html | jwglxt.huuc.edu.cn |
| 河南工程学院 | http://106.system.haue.edu.cn/jwglxt/xtgl/login_slogin.html | 106.system.haue.edu.cn |
| 浙江工业大学 | http://www.gdjw.zjut.edu.cn/jwglxt/xtgl/login_slogin.html | www.gdjw.zjut.edu.cn |
| 福州理工学院 | http://oaa.fitedu.net/jwglxt/xtgl/login_slogin.html | oaa.fitedu.net |
| 西安文理学院 | http://jwgl.xawl.edu.cn/jwglxt/xtgl/login_slogin.html | jwgl.xawl.edu.cn |
| 贵州大学 | https://zhjw.gzu.edu.cn/jwglxt/xtgl/login_slogin.html | zhjw.gzu.edu.cn |
| 郑州航空工业管理学院 | http://jwglxt.zua.edu.cn/jwglxt/xtgl/login_slogin.html | jwglxt.zua.edu.cn |
| 重庆财经学院 | http://jwmis.cfec.edu.cn/jwglxt/xtgl/login_slogin.html | jwmis.cfec.edu.cn |
| 青岛农业大学 | http://jwglxt.qau.edu.cn/jwglxt/xtgl/login_slogin.html | jwglxt.qau.edu.cn |
| 青岛黄海学院 | http://jwxt.qdhhc.edu.cn/jwglxt/xtgl/login_slogin.html | jwxt.qdhhc.edu.cn |

## 怎么试

1. 先用浏览器打开上面的登录地址，能看到教务系统登录页，说明网络和地址没问题。
2. 在小程序里选择该学校，用真实账号导入；成功一次后 `verified` 会自动变 `true`。
3. 候选学校先在「学校管理」里打开「开放自动导入」，再让用户刷新学校列表。
4. 只允许校园网/VPN、带验证码/滑块、使用 SSO 或非新版正方的学校，自动导入会失败。

## 注意

- `https://jwglxt.wuit.cn` 根路径返回 404 是正常的，登录页在 `/jwglxt/xtgl/login_slogin.html`。
- 部分候选地址是 `http://` 或带非 443 端口，云函数可以访问；小程序端不再直连学校域名。
- 文件里的 `verified` 可能落后于云数据库，实际状态以学校管理页为准。
