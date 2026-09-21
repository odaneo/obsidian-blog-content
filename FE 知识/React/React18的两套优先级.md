---
Description: 用输入搜索词的例子区分React18的Lane与Scheduler优先级，说明为什么两者不能简单合并。
Slug: react18-lanes-and-scheduler-priority
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

React18需要同时解决两个问题：这次处理哪些更新，以及什么时候安排执行。Lane和Scheduler优先级分别服务于这两件事。

下面按React18.2.0的实现说明。

## 各自负责什么

| 机制 | 主要作用 |
| --- | --- |
| Lane | 记录更新的优先级和分组，决定这次处理哪些更新 |
| Scheduler优先级 | 决定调度任务的等待时限和执行安排 |

Lane能区分很多类更新，也能把多个标记合并。Scheduler只提供Immediate、UserBlocking、Normal、Low、Idle五档优先级。

Scheduler执行的是回调，不需要知道组件的state改成什么，也不需要理解Fiber树。

## 用搜索框举例

输入文字时，可以让输入框先更新，搜索结果稍后更新：

```javascript
import { startTransition } from 'react';

// 在组件的输入事件处理中使用
function handleChange(event) {
  const text = event.target.value;

  setInput(text);

  startTransition(() => {
    setKeyword(text);
  });
}
```

这里假设input控制输入框，keyword决定搜索列表显示什么。

`setInput`保持紧急，`setKeyword`获得Transition Lane。React可以先显示输入内容，再计算搜索列表。

`startTransition`里的回调本身会立即运行。获得低优先级的是其中触发的状态更新，所以它不会自动把回调里的大段计算移到后台。[React18 Transition说明](https://react.dev/blog/2022/03/29/react-v18#new-feature-transitions)

## 为什么不能只留一套

不同的Lane可能映射到相同的Scheduler优先级。例如，普通更新和Transition更新通常都能映射到Normal，但React仍需要区分它们的紧急程度和处理方式。

如果只保留Normal这个标记，这些信息就丢了。

另外，SyncLane通常走React内部同步队列，不是所有Lane都简单映射成一个Scheduler任务。[React18优先级转换](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L710)
