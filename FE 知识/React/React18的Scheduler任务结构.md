Task是Scheduler保存的待执行工作，通常携带Reconciler回调。一个Task可以处理多个状态更新，不一定与每次setState一一对应。

以下字段和数值以React18.2.0为准。

## 主要字段

```javascript
const task = {
  id,
  callback,
  priorityLevel,
  startTime,
  expirationTime,
  sortIndex
};
```

| 字段 | 含义 |
| --- | --- |
| `id` | 自增编号，排序值相同时用于决定先后 |
| `callback` | 待执行回调 |
| `priorityLevel` | Scheduler优先级 |
| `startTime` | 最早可以执行的时间 |
| `expirationTime` | 任务的过期时间 |
| `sortIndex` | 当前队列中的排序值 |

## 开始时间与过期时间

没有delay时，startTime是创建任务的当前时间；设置delay后才会推迟。

未到开始时间的任务位于timerQueue，按startTime排序。到点后进入taskQueue，按expirationTime排序。

```text
expirationTime = startTime + timeout
```

| 优先级 | timeout |
| --- | --- |
| Immediate | -1ms，立即视为过期 |
| UserBlocking | 250ms |
| Normal | 5000ms |
| Low | 10000ms |
| Idle | 1073741823ms，约12天 |

Normal任务有机会就可以运行，不必等待5秒。过期后，Scheduler不再仅因本轮时间片耗尽而跳过它，但也不保证截止前完成，因为正在执行的代码不会被强行打断。

startTransition降低更新的紧急程度，不会自动设置固定的启动延迟。

## 回调怎样继续

Scheduler向回调传入didTimeout，表示任务是否过期。回调返回函数，表示还有后续工作；返回null，表示结束。后续函数必须真正返回给Scheduler，才会继续调度。[React18 Task实现](https://github.com/facebook/react/blob/v18.2.0/packages/scheduler/src/forks/Scheduler.js)
