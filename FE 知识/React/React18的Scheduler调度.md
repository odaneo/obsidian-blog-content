---
Description: 用分段渲染的过程解释React18的Scheduler，说明时间片、任务复用和MessageChannel分别做什么。
Slug: react-scheduler
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

React18的Scheduler负责安排任务何时运行。页面更新很耗时时，React可以先做一部分，再把主线程交还给浏览器，让输入和绘制有机会执行。

下面的实现细节以React18.2.0为准。

## 任务怎样进入调度器

普通的非同步更新可以简化成：

```text
状态发生更新
→ Reconciler选择要处理的Lanes
→ 检查根节点是否已有合适的任务
→ 必要时向Scheduler注册回调
→ Scheduler运行回调
→ Reconciler计算新界面
```

同步更新通常走React内部的同步队列。因此，每次setState并不都会创建一个Scheduler任务。

## 时间片怎样工作

对于可以分片的并发渲染，Reconciler会在处理Fiber节点之间检查是否该让出主线程。

```text
计算一部分界面
→ 时间用得差不多了
→ 暂停本轮工作并交还主线程
→ 浏览器有机会处理输入或绘制
→ 后续继续计算
```

React18.2.0的默认检查阈值是约5ms。它表示一次连续工作多久后考虑让出，并不是每隔5ms必定运行，也不是每5ms绘制一帧。[React18调度配置](https://github.com/facebook/react/blob/v18.2.0/packages/scheduler/src/SchedulerFeatureFlags.js)

这种暂停需要代码主动配合。如果某个组件内部的循环一次耗时40ms，Scheduler不能从循环中间强行切走。同步更新和部分已经过期的工作，也可能不再分片。

## MessageChannel做什么

在常见浏览器环境中，Scheduler通过`MessageChannel`安排后续执行机会。它发出消息，等消息回调运行时再处理任务。

这仍然是在主线程执行，没有额外开一个线程计算组件。让出之后浏览器是否立刻绘制，由浏览器决定。[React18 Scheduler实现](https://github.com/facebook/react/blob/v18.2.0/packages/scheduler/src/forks/Scheduler.js)

## 两个循环的区别

| 循环 | 处理什么 |
| --- | --- |
| Scheduler的循环 | 从队列取任务，调用任务回调 |
| Reconciler的循环 | 遍历Fiber节点，计算组件变化 |

回调没有做完时，可以返回一个继续工作的函数。Scheduler保留这份后续工作，之后继续执行。

## 已有任务怎样处理

对于同一个根节点，待处理工作的优先级没变时，React通常复用已有任务。出现更紧急的工作时，可以取消旧回调，重新安排执行。

取消的是调度回调，更新队列中的数据仍然保留。这个过程直接理解为任务复用和重新调度即可。[React18根节点调度](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L654)
