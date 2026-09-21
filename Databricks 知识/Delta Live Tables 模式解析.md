---
---
## **Pipeline Execution Mode（执行模式）**

决定 pipeline 是 **一次性跑** 还是 **持续运行**：

| 执行模式 | 特点 |
| --- | --- |
| **Triggered** | 手动/定时触发，每次运行处理所有可用数据后自动停止。适合批处理场景。 |
| **Continuous** | 持续运行，实时/准实时处理数据（尤其是 `STREAMING LIVE TABLE`）。适合流式处理。 |

---

## **Pipeline Development Mode（开发/生产模式）**

决定算力资源如何管理：

| 模式 | 特点 |
| --- | --- |
| **Development mode** | - 用于测试和调试- **不会自动释放 compute 资源**，方便调试后继续测试- 表可能在测试完成后被自动清理（除非配置持久化） |
| **Production mode** | - 用于正式生产环境- **运行结束后自动释放 compute 资源**，节省成本- 表会完整保留，确保下次运行可以接着处理 |

👉 常见组合：

- **Development + Continuous** → 持续更新，但资源不会释放（方便测试）。
- **Production + Continuous** → 持续更新，资源自动管理（适合生产实时流）。
- **Production + Triggered** → 每次触发跑一遍，跑完就释放（适合定时批处理）。