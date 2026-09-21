---
Description: 用输入框和搜索结果的例子解释React18的Lane，说明更新如何分组以及优先级记录在哪里。
Slug: react18-lanes
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

在搜索框里输入文字时，输入框要及时显示新内容，下面的大量搜索结果可以稍后更新。React18通过Lane区分这些更新，让紧急的工作先完成。

下面的内部字段以React18.2.0为准。

## Lane是什么

一个Lane是更新的标记，既表示优先级，也参与决定哪些更新一起处理。

React用数字的二进制位保存这些标记。单个标记叫Lane，多个标记的集合叫Lanes。用按位或运算，就能把几个标记合在一起。

## 常见的Lane

| Lane                  | 常见来源                          |
| --------------------- | ----------------------------- |
| `SyncLane`            | 点击等离散事件中的普通更新、`flushSync`中的更新 |
| `InputContinuousLane` | 鼠标移动、滚动等连续事件中的更新              |
| `DefaultLane`         | 没有特殊优先级的普通更新                  |
| `TransitionLanes`     | `startTransition`中标记的更新       |
| `IdleLane`            | 空闲优先级的更新                      |

这些是常见对应关系，实际还要看更新发生时的上下文。例如，在点击事件里使用`startTransition`，其中的更新会获得Transition Lane。[React18事件优先级](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactEventPriorities.new.js)

## 标记保存在哪里

假设页面里的计数器要更新：

| 位置                      | 记录什么         |
| ----------------------- | ------------ |
| 计数器的`fiber.lanes`       | 这个节点有哪类更新    |
| 祖先节点的`childLanes`       | 下面的子树有哪类更新   |
| 根节点的`root.pendingLanes` | 整棵树还有哪些更新没完成 |

具体的新值或更新函数放在更新队列中。对于`useState`，队列在对应的Hook上；祖先节点只需要知道下面有工作，不会各存一份更新内容。[React18更新标记](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberConcurrentUpdates.new.js)

## 怎样决定先做什么

React先检查根节点上待处理的Lanes，再结合优先级、是否被挂起等情况，选出这次要处理的一组更新。

紧急更新可以先完成，Transition更新留到后面。出现新更新、完成一轮工作，或挂起的内容可以重试时，React都会重新判断后续安排。[React18 Lane实现](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberLane.new.js)

Lane和Scheduler优先级的区别，见[[React18的两套优先级]]。
