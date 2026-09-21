---
---
## COMMENT vs TBLPROPERTIES 区别

| 特性 | **COMMENT** | **TBLPROPERTIES** |
| --- | --- | --- |
| **来源** | ANSI SQL 标准 |  Spark SQL 扩展 |
| **适用场景** | 给表/列写人类可读的描述，比如 `"Contains PII"`<br><br>`CREATE TABLE table_name<br>COMMENT "table comment"<br>AS SELECT ...`<br> | 存储元数据标签、治理配置，比如 `('containsPII'='true', 'retention'='30days')` |
| **获取方式** | `DESCRIBE TABLE EXTENDED ...`  `DESCRIBE DETAIL ...` | `DESCRIBE EXTENDED ...` 会显示 `Properties` |
| **限制** | 只能存一段文字 | 可以存多个键值对，灵活扩展 |

- **表 (table)** → `DESCRIBE EXTENDED table_name`
- **数据库/Schema** → `DESCRIBE DATABASE [EXTENDED] db_name`

## MERGE

在 Delta Lake 里：

- `**MERGE INTO**` 可以用来实现 **upsert**（update + insert），根据主键或唯一标识条件来更新/插入。**但是不负责保证源数据的唯一性。**Databricks Delta 表默认没有主键/唯一约束。
- 要想保证唯一性，必须：
	- 源数据先去重
	- 目标表建立唯一约束

```sql
MERGE INTO target_table AS t //老数据
USING source_table AS s //新数据
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;
```

👉 如果 `id` 已存在 → 更新

👉 如果 `id` 不存在 → 插入

## MERGE vs APPEND

| 功能 | **APPEND** | **MERGE** |
| --- | --- | --- |
| 写入模式 | 直接追加 | 条件驱动，支持 Insert/Update/Delete |
| 是否去重 | ❌ 不会去重 | ✅ 可以避免重复（基于匹配条件） |
| 性能 | 高（开销小） | 较低（涉及匹配、更新） |
| 适用场景 | 日志、事件流 | CDC、维度表更新、去重加载 |
| 复杂度 | 简单 | 复杂 |

## **JOIN / UNION / INTERSECT / MERGE**

| 操作 | 主要用途 | 数据来源 | 是否去重 | 结果集特点 |
| --- | --- | --- | --- | --- |
| **JOIN** (INNER / OUTER) | 按某个条件把两张表**列并列拼接** | 两表的匹配字段 | 不去重 | 行数依赖连接条件，常用来把维度表字段补充到事实表 |
| **UNION** | **纵向合并**两张结果集 | 多个 SELECT 的结果 | ✅ 去重 | 拼接后结果中不会有重复行 |
| **UNION ALL** | **纵向合并**（保留重复） | 多个 SELECT 的结果 | ❌ 不去重 | 适合需要保留重复交易/日志的情况 |
| **INTERSECT** | 取**交集** | 多个 SELECT 的结果 | ✅ 去重 | 结果只保留两边都存在的行 |
| **EXCEPT / MINUS** | 取**差集** | 多个 SELECT 的结果 | ✅ 去重 | A 表有而 B 表没有的记录 |
| **MERGE** | **UPSERT**（更新或插入） | 源表 vs 目标表 | **不自动去重** | 常用于数据仓库 / CDC 场景，保证表最新状态 |

## VACUUM

在 Delta Lake 中：

- 数据更新/删除时，不会修改原文件，而是：
	1. 写新文件（包含修改后的数据）。
	2. 在 `_delta_log` 里标记哪些旧文件作废。
- 好处：保证 ACID 事务，支持 Time Travel（时光回溯）。
- 问题：随着时间推移，旧文件越来越多，虽然逻辑上被“废弃”，但物理上还在存储里。

VACUUM 在 Delta Lake 的作用：

- 清理 不再被任何表版本引用的旧文件，释放存储空间。
- 默认只清理** 7 天前** 的过期数据文件（可改）。
- 常用于防止存储膨胀，但会影响 Time Travel（因为旧文件被删了就回不去了）。

## Databricks SQL UDF（User-Defined Function）

```sql
CREATE FUNCTION function_name(parameter_name data_type, ...)
RETURNS return_data_type
RETURN <sql_expression>;
```

把 `"brooklyn"` 映射为 `"new york"`：

```sql
CREATE FUNCTION combine_nyc(city STRING)
RETURNS STRING
RETURN CASE
         WHEN city = 'brooklyn' THEN 'new york'
         ELSE city
       END;
```

## COPY INTO

`COPY INTO` 是一个 **加载数据的 SQL 命令**。用来把 **外部存储的数据文件**（CSV、JSON、Parquet 等）导入到 **Delta 表** 或 **SQL 表**。

- **幂等性（避免重复加载）**
	- Databricks 会记录已加载过的文件名 → 下次运行不会重复插入。
- **支持多种格式**
	- CSV、JSON、PARQUET、AVRO 等。
- **可以按需加载部分文件**
```sql
COPY INTO mytable
FROM '/mnt/data'
FILES = ('file1.parquet','file2.parquet')
FILEFORMAT = PARQUET;
```
- **适合每日/定期批量加载**（比如 ETL）。

## JDBC 创建表

```sql
CREATE TABLE jdbc_customer360
USING jdbc // org.apache.spark.sql.jdbc
OPTIONS (
  url "jdbc:sqlite:/customers.db",
  dbtable "customer360"
);
```

## 建表时常用的数据源(USING …)

> [!note]+ 文件格式类
> 直接存储在 Data Lake (S3, ADLS, GCS, 本地 HDFS) 上的文件
> 
> - `delta` → Delta Lake 格式（支持 ACID、事务、时间旅行）
> - `parquet` → 列式存储，常用于大数据分析
> - `orc` → 类似 Parquet，但偏向 Hive 生态
> - `csv` → 文本格式，逗号分隔
> - `json` → 文本格式，半结构化数据
> - `avro` → 常见于 Kafka 流数据
> 
> 示例：
> 
> ```sql
> CREATE TABLE sales
> USING parquet
> LOCATION '/mnt/data/sales'
> ```

---

> [!note]+ 外部数据库（通过 **JDBC**）
> 需要 `USING jdbc`，再通过 `OPTIONS` 指定连接参数：
> 
> - MySQL
> - PostgreSQL
> - Oracle
> - SQL Server
> - SQLite
> - 其他支持 JDBC 的数据库
> 
> 示例：
> 
> ```sql
> CREATE TABLE customer360
> USING jdbc
> OPTIONS (
>   url "jdbc:mysql://host:3306/db",
>   dbtable "customers",
>   user "admin",
>   password "pwd"
> )
> ```

---

> [!note]+ 流式 & 自动加载类
> - `cloud_files`（或 `autoloader`） → Databricks 特有，自动检测新文件并增量加载
> - `kafka` → 读取 Kafka 流
> - `eventhubs` → Azure Event Hubs
> - `pubsub` → GCP Pub/Sub
> 
> 示例：
> 
> ```sql
> CREATE TABLE logs
> USING cloud_files
> OPTIONS (
>   path "/mnt/raw/logs",
>   format "json"
> )
> ```

---

## OPTIMIZE 

`OPTIMIZE` 是 Databricks Delta Lake 扩展出来的 SQL 语法，功能是做小文件合并（bin-packing compaction），把很多小的 Parquet 文件合并成大文件，从而提升读取性能。

```sql
-- 合并小文件
OPTIMIZE my_table;

-- 合并并做 Z-Order 排列
OPTIMIZE my_table
ZORDER BY (customer_id, order_date);
```

## COUNT_IF

直接统计满足某个条件的行数（简化写法）。

```sql
-- 统计 rank > 5 的行数
SELECT COUNT_IF(rank > 5)
FROM my_table;
```

👉 等价于：

```sql
SELECT COUNT(*)
FROM my_table
WHERE rank > 5;
```

而COUNT会忽略null

```sql
SELECT COUNT(member_id) 
FROM my_table;
```

## FILTER

条件过滤函数，返回的是子集数组，**不会改变元素的值**

```sql
FILTER(array, element -> boolean_expression)
```

- **array**：要处理的数组列
- **element**：数组中的元素（可以是基本类型，也可以是结构体）
- **boolean_expression**：返回 true/false 的表达式。只有返回 true 的元素会保留

## **TRANSFORM**

用来**修改**表里的值，与**FILTER**不同。

```sql
TRANSFORM(students, i -> i.total_courses + 1)
```

## ON VIOLATION DROP ROW/FAIL UPDATE

| 特性 | **DROP ROW** | **FAIL UPDATE** |
| --- | --- | --- |
| **处理方式** | 丢掉不满足条件的行 | 发现不满足条件的行就让 pipeline 整体失败 |
| **是否继续执行** | ✔️ 流程继续 | ❌ 流程终止 |
| **数据结果** | 只有合格的数据会进入下游，坏数据被静默丢弃 | 没有数据写入，下游完全不更新 |
| **适用场景** | 容忍部分坏数据，保证流水线不中断 | 必须保证数据质量，不能出现坏数据 |
| **典型用法** | `EXPECT (age > 0) ON VIOLATION DROP ROW` | `EXPECT (location IS NOT NULL) ON VIOLATION FAIL UPDATE` |

```sql
CONSTRAINT valid_location // 约束的名字叫 valid_location
EXPECT (location != NULL) // 字段 location 不能是 NULL
ON VIOLATION FAIL UPDATE // 不满足规则，整个 pipeline 失败
```

**注意**：默认规则是**，**违反约束 → 写入表 ✅ + 在日志和 metrics 里标记

## Z-Order

- **Delta 表的存储优化**，让多个列的数据尽量“排在一起”。
- 作用类似“多列索引”，但它不是数据库索引，而是 **数据文件重排**。
- 如果你经常用 `WHERE user_id=... AND date=...`，Z-Order 可以减少要扫描的数据块。而且**比单列分区更灵活，**分区只能按一列，Z-Order 可以让多个列一起优化。

## CREATE DATABASE/CREATE SCHEMA

等价，创建一个表

## GRANT

```sql
GRANT <privilege_list>
ON <object_type> <object_name>
TO <principal>;
```

- `<privilege_list>` → 权限列表，如 `USAGE`、`SELECT`、`MODIFY`、`CREATE`、`ALL PRIVILEGES`
- `<object_type>` → 对象类型：`CATALOG` / `DATABASE` (或 `SCHEMA`) / `TABLE` / `VIEW`
- `<object_name>` → 具体对象名，如 `customers`
- `<principal>` → 授权对象，通常是用户或组（如 `team`）

## GRANT USE SCHEMA

允许用户在该 schema 下执行任何操作（无论是读、写还是管理），但具体能不能操作还要看用户是否额外被授予了其他权限（比如 SELECT、INSERT、ALTER 等）。

## 权限

| 权限 | 适用对象 | 作用 | 典型用途 |
| --- | --- | --- | --- |
| **USAGE** | Catalog / Database (Schema) | 允许用户访问指定 Catalog / Database，看见里面有哪些对象（表、视图等），但不能查询或修改数据 | “发现性权限”，比如 看见有哪些表 |
| **SELECT** | Table / View | 允许读取数据（查询、导出） | 分析师、报表开发者需要读数据 |
| **MODIFY** | Table / View | 允许写数据（INSERT、UPDATE、DELETE、MERGE） | 数据工程师修改数据表 |
| **CREATE** | Catalog / Database | 允许在 Catalog / Database 下创建对象（表、视图、函数等） | 数据工程师建表、建视图 |
| **DROP** | Table / View / Database | 允许删除对象 | 数据管理员清理旧表 |
| **ALL PRIVILEGES** | Catalog / Database / Table | 包含所有权限（USAGE、SELECT、MODIFY、CREATE、DROP 等） | 管理员或项目负责团队需要“完全控制权” |
| **VIEW**（Databricks 特有扩展，有时见于 Catalog） | Catalog | 允许查看 Catalog 元数据 | 类似于 USAGE，但颗粒度更高 |
| **OWNERSHIP** | 任意对象 | 拥有对象的完全控制权（可以转让、授权他人） | 表/数据库的 owner 可以管理一切权限 |
