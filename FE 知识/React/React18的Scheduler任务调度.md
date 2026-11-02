Scheduler安排任务何时运行。对于可分片的更新，React可以计算一部分界面后交还主线程，让浏览器有机会处理输入和绘制。

以下实现以React18.2.0为准。

## 任务怎样进入调度器

```text
状态发生更新
→ Reconciler选择要处理的Lanes
→ 检查根节点是否已有合适的任务
→ 必要时向Scheduler注册回调
→ Scheduler运行回调
→ Reconciler计算新界面
```

同步更新通常走React内部同步队列，因此每次setState不一定新建Scheduler任务。

## 时间片怎样工作

```text
计算一部分界面
→ 时间用得差不多了
→ 暂停本轮工作并交还主线程
→ 浏览器有机会处理输入或绘制
→ 后续继续计算
```

Reconciler在处理Fiber节点之间检查是否需要让出主线程。默认检查阈值约5ms，表示连续工作到这个时间后考虑让出，并非每5ms必定执行或绘制一帧。[调度配置](https://github.com/facebook/react/blob/v18.2.0/packages/scheduler/src/SchedulerFeatureFlags.js)

让出需要代码配合。某个组件内部的循环一次耗时40ms，Scheduler无法从循环中间强行切走。同步或部分已过期的工作也可能不再分片。

## MessageChannel的作用

常见浏览器环境中，Scheduler通过MessageChannel安排后续回调。计算仍在主线程上，浏览器是否在让出后立即绘制，由浏览器决定。[Scheduler实现](https://github.com/facebook/react/blob/v18.2.0/packages/scheduler/src/forks/Scheduler.js)

| 循环 | 处理对象 |
| --- | --- |
| Scheduler循环 | 取出任务，执行回调 |
| Reconciler循环 | 遍历Fiber，计算组件变化 |

回调返回一个继续工作的函数时，Scheduler会保留后续工作，稍后再执行。

## 任务怎样复用

同一根节点的待处理优先级不变时，React通常复用已有任务。出现更紧急的工作，可以取消旧回调并重新调度，更新队列中的数据仍保留。[根节点调度](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L654)
