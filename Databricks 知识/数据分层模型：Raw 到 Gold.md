---
---
| 层级 | 主要任务 | 格式化举例 |
| --- | --- | --- |
| **Raw → Bronze** | 应用 schema，让原始数据能落表，**数据落盘** | JSON 日志 `{ "ts": "2025-08-18 10:00", "uid": "123" }` → 表字段 `(ts STRING, uid STRING)` |
| **Bronze → Silver** | **清洗** & 标准化，保证数据可用 | `"2025-08-18 10:00"` → 转成 `TIMESTAMP` 类型；手机号 `"090-1234-5678"` → `09012345678`；去掉重复行 |
| **Silver → Gold** | 业务聚合 & 指标化，**生成分析表** | 按用户 ID 聚合交易表，计算 `"月度消费总额"`；按日期聚合日志，产出 `"DAU（日活跃用户数）"` |

- 看到 `**readStream.load**`**/**`**cloudFiles**` → 高概率是 **Bronze→Silver**。
- 看到 `**table("silver...")**`** 作输入**、且 **groupBy/agg/window/join 维表** → 典型 **Silver→Gold**。
- **输出模式**：Silver 常用 `append`；Gold 做聚合时常用 `complete`（或 `foreachBatch` 合并）。
