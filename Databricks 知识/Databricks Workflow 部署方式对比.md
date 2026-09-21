---
---
| 部署方式 | 版本控制能力 | 跨环境部署能力 (Dev → Prod) | 适用场景 | 局限性 |
| --- | --- | --- | --- | --- |
| **Notebook built-in version history** | 弱（只能看到历史版本） | ❌ 不支持 | 临时回滚 Notebook | 不是团队协作用的版本控制；不能做 CI/CD |
| **Databricks UI (手动创建 Jobs)** | ❌ 无版本控制 | ❌ 仅限当前工作区 | 简单测试，临时调度 | 不可复现；易出错；无法自动化 |
| **Databricks REST API** | ✅（可结合 Git 管理代码） | ⚠️ 支持，但需自建脚本和 CI/CD 流程 | 自定义部署，灵活 | 需要额外维护脚本和 API 集成，复杂度高 |
| **Databricks Asset Bundles (DAB)** ✅ 推荐 | ✅ Git 真正版本控制（代码+配置） | ✅ 原生支持多环境部署（staging/prod） | 企业级 CI/CD，团队协作 | 需要学习/配置 DAB，但官方推荐 |
