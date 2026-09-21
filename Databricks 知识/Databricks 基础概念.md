---
---
## Delta Live Tables

- 内置 **Expectations** 功能，可以声明式定义数据质量规则（例如某列不能为空、值必须在范围内等）。
- DLT 会自动化地 **监控、统计并报告** 数据质量，不仅能过滤或修复不合格数据，还能生成可视化监控结果。
- **支持处理 CDC（Change Data Capture） 数据源**，并提供了简化 CDC 应用的命令（`APPLY CHANGES INTO`）

## **Change Data Capture**

CDC（Change Data Capture，变更数据捕获）是一种技术，用于实时或准实时捕捉和记录数据库中数据的增量变化（新增、更新、删除），并将这些变化高效传递到下游系统，从而避免全量扫描和同步，常用于数据湖、数据仓库和流式处理场景，以保证数据更新的及时性和一致性。

## Auto Loader

- **Auto Loader** 本质上是基于 **Spark Structured Streaming** 构建的工具，用来实现对云存储中新文件的 **增量发现和处理**。
- **Auto Loader** 的主要作用是 **高效摄取（ingest）大量文件到 Delta Lake**，它可以自动发现新文件、支持 schema evolution，但它 **不负责数据质量监控**。

## **Metastore**

在 Databricks 里，**Metastore 是存放所有数据对象的中央目录**，它保存了：

- **对象的元数据**（catalog、schema、table、view、function 等的定义）
- **访问控制信息**（谁能读、写、管理这些对象）
- **存储位置的映射**（数据到底在 S3/ADLS/GCS 的哪里）

```sql
Metastore
  └── Catalog
        └── Schema (Database)
              └── Table / View / Function
```

## ELT

ELT 就是 **先存后算**，区别于 ETL 的 **先算后存**。

- 含义
	- **Extract（抽取）**：从源系统（数据库、API、日志等）提取原始数据。
	- **Load（加载）**：直接把原始数据加载到目标存储（通常是数据湖或数据仓库）。
	- **Transform（转换）**：在目标存储里利用计算引擎（SQL、Spark、dbt 等）对数据做清洗、聚合、标准化。
- 和 ETL 的区别
	- **ETL（Extract → Transform → Load）**：先在中间处理层做转换，再写入目标库。
	- **ELT（Extract → Load → Transform）**：先把数据落地，再利用仓库/湖本身的算力去做转换。
- 为什么现在常用 ELT
	- 现代数据仓库（Snowflake、BigQuery、Databricks Delta Lake）算力强，存储便宜，直接把原始数据先存下来再处理更灵活。
	- 数据工程师可以重复转换、回溯原始数据，不怕“转坏了再也找不回”。
	- **Delta Live Tables属于这个框架，而且是声明式的。**

## Delta Lake

Delta Lake 是一个**开源存储层**，基于 Apache Parquet 构建，主要目标是把数据湖 (Data Lake) 的灵活性和数据仓库 (Data Warehouse) 的可靠性结合起来。

- **ACID 事务**
	- 确保并发写入、更新时数据不会出错。
	- 避免“脏数据”“部分写入”等问题。
- **模式管理**
	- **Schema enforcement**：写入数据时强制匹配定义好的模式。
	- **Schema evolution**：允许在需要时自动增加新字段。
- **时光回溯 (Time Travel)**
	- 可以查询历史版本的数据，用于调试、回溯、审计。
- **批流统一 (Batch + Streaming)**
	- 同一份数据既能流式写入 (Streaming ingestion)，也能批量分析。
	- 实现真正的 **lambda 架构简化**。
- **高性能索引与缓存**
	- Delta Lake 维护事务日志（_delta_log），能更快查找和合并数据。

| 特性 | **Batch（批处理）** | **Streaming（流处理）** |
| --- | --- | --- |
| **处理方式** | 一次性处理一大批数据 | 数据一到就马上处理 |
| **数据到达** | 等数据全部准备好再处理 | 数据源源不断到来，持续处理 |
| **延迟** | 高（分钟、小时、天） | 低（秒级甚至毫秒级） |
| **典型场景** | 每天跑销售报表、月度结算 | 实时库存更新、实时监控告警 |
| **运行模式** | 定时任务（有开始有结束） | 常驻任务（一直运行） |
| **优点** | 吞吐量大、适合大规模历史数据 | 低延迟、实时性强 |
| **缺点** | 不实时 | 复杂度高、资源消耗大 |

## 存储架构

| 存放内容 | Control Plane (Databricks 托管) | Data Plane (客户云账户，S3等) |
| --- | --- | --- |
| **Databricks Web 应用 (UI, Workspace)** | ✅ | ❌ |
| **Cluster 管理元数据** | ✅ | ❌ |
| **Repos (Git 集成)** | ✅（或外部 GitHub/GitLab） | ❌ |
| **Notebooks** | ✅ | ❌ |
| **数据 (Delta/Parquet/CSV/JSON 等)** | ❌ | ✅ |

## Unity Catalog Data Lineage

- **Data Lineage（数据血缘）** 就是“数据从哪里来、怎么流动到哪里去”的记录。能全局展示数据来源和去向的功能。
- Unity Catalog 提供全局的数据血缘，能看到某张表是由哪个查询、哪个 notebook 生成的，哪些 dashboard 在用它。

## SQL Warehouse

执行 Databricks SQL 的 compute cluster，SQL Warehouse 是 **计算资源**（集群）。

## Databricks Connect

- 开发者可以在 **本地 IDE**（PyCharm, VSCode, Jupyter 等）里写 Spark 代码。
- 代码实际在 **Databricks 集群上远程执行**，这样可以利用集群的算力，同时保留本地开发体验。

## Liquid Clustering

- **Liquid Clustering** 是 Databricks 的一种自动增量优化数据布局的技术。
- 它会不断对表中的数据进行 **增量重写 (incremental re-clustering)**，让数据按查询常用的过滤列聚合在一起。
- 查询时可以 **跳过大部分无关文件**，只扫描相关的数据块，从而提升性能。

## CTAS

**CTAS = CREATE TABLE AS SELECT**

👉 就是通过一个SELECT查询的结果，直接新建一张表，并把查询出来的数据存进去。

它是一种“一步到位”的建表方式。

| 特性 | 普通 `CREATE TABLE` | CTAS (`CREATE TABLE AS SELECT`) |
| --- | --- | --- |
| **Schema 定义** | 手动写 `(col1 INT, col2 STRING)` | 自动从 `SELECT` 推断 |
| **数据** | 默认是空表，需要 `INSERT` | 创建时自动插入查询结果 |
| **适用场景** | 建表结构，不一定立刻要数据 | 直接生成一个带数据的新表 |
| **限制** | 灵活，可以定义分区、约束 | **不能手动指定 schema，只能跟随查询结果** |

## 数据血缘（Data Lineage）

数据血缘就是“数据的来龙去脉”。它告诉你：数据最早是从哪来的 → 中间经过了哪些清洗、计算、加工 → 最后去哪儿用（比如报表、模型）。

1. **Bronze 层（原材料库）**
	- 数据血缘在这层回答的问题是：**“这份数据最早从哪来的？”**
2. **Silver 层（加工车间）**
	- 数据血缘在这层能告诉你：**“这数据是怎么组合出来的？”**
	- 这是最关键的一层，因为清洗、去重、标准化、字段计算都在这里发生。
3. **Gold 层（成品餐厅）**
	- 最后形成报表、KPI、可视化，完成交付。
	- 血缘在这层回答的是：**“报表上的这个数字，是由哪些表、哪些字段一步步算出来的？”**
