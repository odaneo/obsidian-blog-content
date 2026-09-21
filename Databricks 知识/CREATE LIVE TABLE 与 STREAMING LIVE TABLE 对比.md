---
---
| 特性 | CREATE LIVE TABLE | CREATE STREAMING LIVE TABLE |
| --- | --- | --- |
| 数据类型 | 静态（Batch 数据） | 流式（Streaming / Incremental 数据） |
| 处理方式 | 一次性全量处理（snapshot），批处理，每次 pipeline 触发时批量更新 | 持续增量处理（micro-batch / continuous） |
| 使用场景 | 历史数据加载、批量计算 | 实时日志、事件流、IoT、CDC 数据 |
| 执行引擎 | Spark SQL / 批处理 | Spark Structured Streaming |
| 示例 | `CREATE LIVE TABLE customers_bronze AS SELECT * FROM raw_customers` | `CREATE STREAMING TABLE sales_silver<br>AS SELECT store_id, total + tax AS total_after_tax<br>FROM ``**STREAM**``(sales_bronze)` |
