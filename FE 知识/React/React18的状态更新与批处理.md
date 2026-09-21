---
Description: 用计数器解释React18的状态快照和自动批处理，说明函数式更新与flushSync的实际效果。
Slug: react18-state-updates-and-batching
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

调用状态更新函数，是告诉React下一次应该用什么数据。它不会直接改写当前函数里已经读到的state。

下面以React18的`createRoot`用法为准，主要看函数组件中的`setCount`。

## 为什么马上读取还是旧值

```jsx
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // 第一次点击输出0
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

每次渲染都有自己那份count。第一次点击时，handleClick拿到的是0。下一次渲染会得到1，提交后页面才显示1。

这里读取到旧值的原因是当前函数持有旧的状态快照，不能只用“setState是异步的”解释。

## 为什么连续加两次只加了一次

假设这次渲染的count是0：

```javascript
setCount(count + 1);
setCount(count + 1);
```

这相当于连续两次请求把值设为1，结果仍是1。

如果希望连续加两次，可以传更新函数：

```javascript
setCount(value => value + 1);
setCount(value => value + 1);
```

React按队列处理这些函数，后一个接着前一个的结果计算，所以最后是2。[React函数式更新说明](https://legacy.reactjs.org/docs/hooks-reference.html#functional-updates)

## 自动批处理是什么

批处理就是把多个状态更新集中处理，通常用一轮render和commit完成，减少重复工作。每条更新仍然会被处理。

### React17已经有批处理

在React的事件处理函数里，React17就会批处理：

```javascript
function handleClick() {
  setCount(value => value + 1);
  setVisible(true);
  // React17也会把这两个更新一起处理
}
```

所以，连续调用两次状态更新函数，不一定会渲染两次。关键看更新发生在哪种回调里。

### React18扩大了批处理范围

React18使用`createRoot`后，更多场景会自动批处理：

| 更新发生在哪里 | React17默认行为 | React18使用createRoot |
| --- | --- | --- |
| 同一个React事件处理函数 | 会批处理 | 会批处理 |
| 同一个定时器回调 | 通常不批处理 | 会批处理 |
| 同一个Promise回调 | 通常不批处理 | 会批处理 |
| 同一个原生事件回调 | 通常不批处理 | 会批处理 |

这里的React事件处理函数，例如JSX中`onClick={handleClick}`指定的函数。原生事件回调则通过`addEventListener`注册。

批处理并非React18才有，React18让它自动生效的范围更大。继续使用旧的`ReactDOM.render`，仍会保留旧的批处理行为。[React18批处理说明](https://github.com/reactwg/react-18/discussions/21)

### 用定时器比较

假设count最初是0，visible最初是false：

```javascript
setTimeout(() => {
  setCount(value => value + 1);
  setVisible(true);
}, 1000);
```

对于这两个普通更新，React17通常分别处理：

```text
setCount → render计算 count=1、visible=false → commit
setVisible → render计算 count=1、visible=true → commit
```

React18使用`createRoot`时，会先记录两个更新，再一起处理：

```text
记录setCount和setVisible
→ render计算 count=1、visible=true
→ commit
```

两个要求都生效了，只是省掉了中间那轮重复工作。这里比较的是React的计算和提交次数，浏览器实际绘制几次是另一件事。

不同的用户点击仍会分别处理，也不能把所有异步回调里的更新都当成同一批。像`flushSync`这样要求提前提交的情况，见下一节。

## flushSync能改变什么

在事件回调里，`flushSync`可以要求React在它返回前完成相关DOM更新：

```javascript
import { flushSync } from 'react-dom';

// 假设这次渲染的count为0，且下面是点击处理函数
function handleClick() {
  flushSync(() => {
    setCount(value => value + 1);
  });

  // 页面上的数字已经更新
  console.log(count); // 仍然是0
}
```

DOM已经更新，当前函数里的count仍然来自旧渲染。这两件事可以同时成立。

`flushSync`适合第三方库需要马上读取最新DOM等场景。它会打断正常的批处理，也可能处理其他待完成的更新，不适合每次更新都使用。[React18 flushSync示例](https://github.com/reactwg/react-18/discussions/21)
