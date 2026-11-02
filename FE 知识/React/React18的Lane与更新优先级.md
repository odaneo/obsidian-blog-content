搜索框需要及时显示输入，大量搜索结果可以稍后更新。React18通过Lane标记这些更新，决定先处理哪些工作。以下内部字段以React18.2.0为准。

## Lane是什么

Lane是更新标记，既表示优先级，也参与更新分组。单个标记用一个二进制位表示，多个标记组成Lanes，可通过按位或合并。

| Lane | 常见来源 |
| --- | --- |
| `SyncLane` | 点击等离散事件中的普通更新、flushSync更新 |
| `InputContinuousLane` | 鼠标移动、滚动等连续事件 |
| `DefaultLane` | 没有特殊优先级的普通更新 |
| `TransitionLanes` | startTransition标记的更新 |
| `IdleLane` | 空闲优先级更新 |

实际分配还取决于调用上下文。例如，点击事件中的startTransition更新仍会取得Transition Lane。[React18事件优先级](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactEventPriorities.new.js)

## 标记存在哪里

| 位置 | 记录什么 |
| --- | --- |
| `fiber.lanes` | 当前节点有哪些更新 |
| 祖先的`childLanes` | 子树有哪些更新 |
| `root.pendingLanes` | 整棵树还有哪些待处理更新 |

具体新值或更新函数保存在更新队列里。`useState`的队列属于对应Hook，祖先只汇总标记，不会各复制一份更新内容。[React18更新标记](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberConcurrentUpdates.new.js)

## 怎样选择下一轮工作

React检查根节点的待处理Lanes，结合优先级、挂起状态等条件，选择本轮处理的一组更新。出现新更新、完成工作或挂起内容可以重试时，会重新安排后续工作。[Lane实现](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberLane.new.js)

与Scheduler优先级的区别见[[React18的Lane与Scheduler优先级]]。
