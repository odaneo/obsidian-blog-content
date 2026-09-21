---
---
| 工具 | 用途 | 适用场景 | 局限性 |
| --- | --- | --- | --- |
| `**%run**`** magic command** | 运行另一个 Notebook 或 Python 脚本，就像导入模块 | 复用代码，比如公共函数库、配置脚本 | 仅执行，不支持调试 |
| `**%debug**`** magic command** | 进入 **事后调试模式**（post-mortem debugging） | 在异常报错后，交互式查看栈帧、变量 | 只能在出错后用，不能主动设置断点 |
| **Notebook Interactive Debugger** | 在 Notebook 里设置断点，支持单步执行、进入函数、实时检查/修改变量 | 需要逐行调试逻辑，定位 `None` 或数据错位等问题 | 调试过程中运行较慢，不适合大规模生产任务 |