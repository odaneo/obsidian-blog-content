| 特性     | Amazon Aurora         | Amazon DynamoDB          | Amazon DocumentDB       |
| ------ | --------------------- | ------------------------ | ----------------------- |
| 数据库类型  | 关系型 (SQL)             | 非关系型 (NoSQL - Key-Value) | 非关系型 (NoSQL - Document) |
| 兼容性    | MySQL 与 PostgreSQL    | AWS 自有 API               | MongoDB                 |
| 数据模型   | 表格 (行/列)，严格 Schema    | 键值对、JSON 文档，灵活 Schema    | JSON 样式的文档              |
| 扩展能力   | 垂直扩展 (计算) + 水平扩展 (读取) | 极强，自动水平扩展 (无上限)          | 水平扩展 (读取副本)             |
| 事务支持   | 强一致性，完整 ACID 支持       | 支持跨表事务                   | 支持 ACID 事务              |
| 运维模式   | 托管实例 或 Serverless v2  | 完全 Serverless，按需模式       | 托管集群 (基于实例)             |
| 主要性能指标 | 毫秒级延迟                 | 个位数毫秒级延迟                 | 毫秒级延迟                   |
| 存储限制   | 最高 128 TB             | 无限制                      | 最高 128 TB               |
