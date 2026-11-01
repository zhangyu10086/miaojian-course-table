# 第三方开源声明

本项目在设计和实现过程中参考了以下开源项目。代码为独立重写，未直接复制其 Kotlin/Compose 实现；但数据模型、交互思路和正方解析逻辑受其启发，按许可证要求保留署名。

## 拾光课程表（shiguangschedule）

- 仓库：https://github.com/XingHeYuZhuan/shiguangschedule
- 许可证：Apache License 2.0
- 许可证副本：`licenses/Apache-2.0.txt`
- 参考内容：
  - `Course` / `CourseWeek` / `CourseTableConfig` 数据模型
  - 周视图课程块、冲突分列布局思路
  - 周次选择、今日课程、课程颜色等交互

```
Copyright (C) 2025 XingHeYuZhuan
Licensed under the Apache License, Version 2.0
```

## shiguang_warehouse

- 仓库：https://github.com/XingHeYuZhuan/shiguang_warehouse
- 许可证：MIT
- 许可证副本：`licenses/MIT-shiguang_warehouse.txt`
- 参考内容：
  - 正方教务 HTML 课表的字段解析思路
  - `zcd` 周次、`jcs` 节次、`kcmc/xm/cdmc/xqj` 字段处理
  - 学校名称、教务地址等元数据（`docs/schools-batch.json`，25 条，均已标记为未验证）

```
MIT License
Copyright (c) 2025 星河欲转
```

## 其他参考

- 正方教务系统接口参考：https://github.com/openschoolcn/zfn_api
- 微信小程序文档：https://developers.weixin.qq.com/miniprogram/dev/framework/
- 微信云开发文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/

本项目与上述项目及其维护者没有隶属关系。
