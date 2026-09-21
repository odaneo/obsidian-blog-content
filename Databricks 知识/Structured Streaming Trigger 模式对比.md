---
---
| 模式 | 语法 | 行为 | 典型用途 |
| --- | --- | --- | --- |
| **Micro-batch (default)** | `.trigger(processingTime="5 seconds")` | 每隔 5 秒启动一个 micro-batch，持续运行 | 实时流处理（常见 ETL、DLT pipeline） |
| **Once** | `.trigger(once=True)` | 只运行 **一个 micro-batch**，执行一次后退出 | 小规模批处理，测试运行 |
| **AvailableNow** | `.trigger(availableNow=True)` | 执行 **多个 micro-batches**，直到处理完 backlog 后自动退出 | 一次性大批量补数据（backfill） |
| **Continuous** (实验性) | `.trigger(continuous="5 seconds")` | **低延迟连续处理**（record-at-a-time），目标 < 1 秒延迟 | 超低延迟场景（如金融监控），受限较多 |

### Spark 默认行为

- 如果没有指定 `.trigger(...)`，Structured Streaming 默认是：
```python
.trigger(processingTime="500 milliseconds")
```
- 也就是说，**默认每 500 毫秒触发一次 micro-batch**。
