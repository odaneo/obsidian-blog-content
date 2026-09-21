---
Description: 解释React18调度任务的几个主要字段，区分开始时间、过期时间和继续执行的回调。
Slug: react18-scheduler-task
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

Task是Scheduler保存的一份待执行工作。React18中，它通常带着Reconciler提供的回调，执行时再计算某个根节点的更新。

一个Task可能处理多个状态更新，并不是每次setState都对应一个Task。以下字段按React18.2.0说明。

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
| `id` | 自增编号，排序值相同时也用它决定先后 |
| `callback` | 要执行的函数 |
| `priorityLevel` | Scheduler的优先级 |
| `startTime` | 从什么时候起可以执行 |
| `expirationTime` | 等到什么时候算过期 |
| `sortIndex` | 当前所在队列使用的排序值 |

## 开始和过期有什么区别

没有配置延迟时，`startTime`就是创建任务时的时间。配置了`delay`，才会把开始时间推后。

未到开始时间的任务放在`timerQueue`，按开始时间排序。到点后进入`taskQueue`，按过期时间排序。

`startTransition`降低的是更新的紧急程度，不会自动给Scheduler任务添加一个固定的启动延迟。

## 过期不等于到点才执行

过期时间的计算方式是：

```text
expirationTime = startTime + timeout
```

React18.2.0中，各优先级的timeout如下：

| 优先级 | timeout |
| --- | --- |
| Immediate | -1ms，立即视为过期 |
| UserBlocking | 250ms |
| Normal | 5000ms |
| Low | 10000ms |
| Idle | 一个很大的值，约12天 |

例如，Normal任务不是要等5秒才运行。只要有执行机会，它可以马上运行；等太久则会被视为过期，Scheduler不再仅因为本轮时间片耗尽而跳过它。

这也不保证它在截止时间前完成。主线程正在执行的代码不会被强行中断。

## 回调没有做完怎么办

Scheduler会把`didTimeout`传给回调，说明这个任务是否过期。

回调返回另一个函数，表示还有后续工作；返回`null`，表示这个任务已经结束。需要继续时，必须把后续函数真正返回给Scheduler，不能调用完后固定返回`null`。[React18 Task实现](https://github.com/facebook/react/blob/v18.2.0/packages/scheduler/src/forks/Scheduler.js)
