React18需要决定本轮处理哪些更新，以及什么时候安排执行。Lane和Scheduler优先级分别参与这两件事，以下按18.2.0说明。

| 机制 | 作用 |
| --- | --- |
| Lane | 标记更新的优先级和分组，选择本轮处理的更新 |
| Scheduler优先级 | 决定调度任务的等待时限和执行安排 |

Lane有多种标记，可以合并。Scheduler提供Immediate、UserBlocking、Normal、Low和Idle五档，只负责执行回调，无须理解组件状态和Fiber树。

## 搜索框的例子

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

假设input控制输入框，keyword决定搜索列表。setInput保持紧急，setKeyword取得Transition Lane，React可以先显示输入，再计算搜索结果。

startTransition回调本身立即执行，低优先级的是其中触发的状态更新。把大段计算放进回调，不会让计算自动转移到后台。[React18 Transition说明](https://react.dev/blog/2022/03/29/react-v18#new-feature-transitions)

## 为什么需要两套标记

不同Lane可能映射到同一Scheduler优先级。普通更新与Transition更新通常都映射为Normal，但React仍需保留它们的分组和处理差异。

SyncLane通常走内部同步队列，也不是每个Lane都对应一个Scheduler任务。[优先级转换](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L710)

Lane保存位置见[[React18的Lane与更新优先级]]。
