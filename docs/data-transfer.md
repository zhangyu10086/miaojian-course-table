# 课表导入与导出

入口：小程序「我的」→「导入课表 / 导出课表」。

## 导入

1. **从微信文件导入**
   - JSON：完整课表 + 学期设置
   - CSV：Excel 编辑过的课表
   - ICS：日历文件
2. **从剪贴板导入**：JSON
3. **手动添加课程**

导入会替换当前课表；如果文件里包含学期设置，也会一并覆盖。

## 导出

1. 分享 JSON 文件
2. 分享 CSV 文件
3. 导出 ICS 文件
4. 复制 JSON 到剪贴板

文件通过微信「分享到聊天」发送，不会上传到服务器。

## JSON 格式

```json
{
  "version": 1,
  "exportedAt": 1793000000000,
  "settings": {
    "semesterStartDate": "2026-09-07",
    "totalWeeks": 17,
    "firstDayOfWeek": 1,
    "sections": [
      { "number": 1, "startTime": "08:00", "endTime": "08:45" }
    ]
  },
  "courses": [
    {
      "id": "abc123",
      "name": "高等数学",
      "teacher": "华罗庚",
      "location": "A101",
      "day": 1,
      "startSection": 1,
      "endSection": 2,
      "weeks": [1, 2, 3, 5],
      "colorIndex": 1,
      "remark": "",
      "credit": 4,
      "source": "manual"
    }
  ]
}
```

## CSV 格式

表头固定：

```
课程名,教师,地点,星期,开始节次,结束节次,周次,颜色序号,备注,学分
```

- 星期：1–7，或「周一」到「周日」
- 周次：`1-8|10-16`，多段用 `|` 分隔
- 文件请保存为 **UTF-8**
- 导出时会带 BOM，方便 Excel 打开中文

## ICS 格式

- 每门课的每一周生成一个日历事件
- 事件里带自定义字段 `X-MIAOJIAN-COURSE`，所以本小程序导出的 ICS 可以完整往返
- 也带 `X-MIAOJIAN-SETTINGS`，导入时恢复学期设置
- 从其他日历应用导入时，只能根据标题、地点、开始结束时间近似推断星期、节次和周次
- 导出前必须在「学期与节次设置」里填写第 1 周开始日期

## 限制

- CSV 暂不支持 GBK 编码，Excel 另存时请选 UTF-8
- ICS 的重复规则（RRULE）不做完整解析，外部日历的复杂重复可能只导入第一次
- 文件分享依赖微信版本；不支持时会退化为复制到剪贴板
- 单个文件限制 5MB

## 测试

```bash
npm test
```

覆盖：CSV 引号/逗号/换行、JSON 往返、ICS 往返、周次范围解析。
