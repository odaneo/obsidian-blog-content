状态更新函数告诉React下一次使用什么数据，不会改写当前函数已经读到的state。下面以React18的createRoot和函数组件为例。

## 当前回调持有状态快照

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

第一次点击时，handleClick使用的是本次渲染的count，也就是0。下一次渲染取得1，提交后页面显示1。

## 连续更新为什么只加一次

假设当前count为0：

```javascript
setCount(count + 1);
setCount(count + 1);
```

两次都是要求把值设为1。要连续加两次，可以使用更新函数：

```javascript
setCount(value => value + 1);
setCount(value => value + 1);
```

React按队列依次计算，后一个接收前一个的结果，最终得到2。[函数式更新说明](https://legacy.reactjs.org/docs/hooks-reference.html#functional-updates)

## 自动批处理

批处理将多个更新集中处理，通常减少重复的render和commit，每条更新仍然生效。

| 更新所在回调 | React17默认行为 | React18使用createRoot |
| --- | --- | --- |
| 同一个React事件回调 | 批处理 | 批处理 |
| 同一个定时器回调 | 通常不批处理 | 批处理 |
| 同一个Promise回调 | 通常不批处理 | 批处理 |
| 同一个原生事件回调 | 通常不批处理 | 批处理 |

React事件回调由JSX中的onClick等指定，原生事件回调则通过addEventListener注册。React18扩大了自动批处理范围；继续使用旧的ReactDOM.render时，仍保留旧行为。[React18批处理说明](https://github.com/reactwg/react-18/discussions/21)

例如，count初始为0，visible初始为false：

```javascript
setTimeout(() => {
  setCount(value => value + 1);
  setVisible(true);
}, 1000);
```

React17通常分别提交两个更新，中间出现count为1、visible为false的结果。React18使用createRoot时，把两个更新一起处理，直接提交count为1、visible为true的结果。

这里比较React的计算和提交次数，浏览器绘制次数由其他条件决定。不同用户点击也会分别处理，不能把所有异步回调都看成同一批。

## flushSync的作用

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

flushSync返回前，相关DOM已经更新，但当前回调的count仍来自旧渲染，所以读取结果还是0。

它适合第三方库需要立即读取DOM等场景，也可能处理其他待完成更新，应避免频繁使用。[flushSync说明](https://github.com/reactwg/react-18/discussions/21)
