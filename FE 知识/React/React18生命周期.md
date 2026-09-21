---
Description: 按挂载、更新和卸载梳理React18的类组件生命周期，再说明函数组件怎样通过Effect执行和清理副作用。
Slug: react18-component-lifecycle
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

React18组件的生命周期可以分成三个过程：第一次显示是挂载，数据变化后重新计算界面是更新，从页面移除是卸载。

## 类组件的执行顺序

下面列出正常流程。部分方法没有定义时会跳过；`shouldComponentUpdate`返回false时，也会跳过这次组件渲染。

```text
挂载
constructor → getDerivedStateFromProps → render → componentDidMount

更新
getDerivedStateFromProps → shouldComponentUpdate → render
→ getSnapshotBeforeUpdate → componentDidUpdate

卸载
componentWillUnmount
```

## 常见方法做什么

| 方法 | 用途 |
| --- | --- |
| `constructor` | 初始化state和绑定方法，先调用`super(props)` |
| `render` | 根据props和state返回JSX |
| `componentDidMount` | 挂载后发请求、建立订阅 |
| `componentDidUpdate` | 更新后处理变化，能拿到之前的props和state |
| `componentWillUnmount` | 清除定时器、取消订阅 |

`constructor`和`render`适合纯计算，不适合发请求或修改页面。更新时可能反复执行的渲染逻辑，不应顺带改变外部状态。

## 另外三个方法

`getDerivedStateFromProps`用于少数需要根据props调整state的场景。它在首次挂载和后续更新时都会调用，并不只在props变化时调用。

`shouldComponentUpdate`用来跳过不必要的渲染。`PureComponent`提供了对props和state的浅比较。

`getSnapshotBeforeUpdate`在DOM改动前读取页面信息，再把返回值交给`componentDidUpdate`。例如聊天列表新增消息时，先记录原来的滚动位置，更新后再调整滚动条。[React类组件文档](https://legacy.reactjs.org/docs/react-component.html)

## 函数组件怎样处理

函数组件通过Effect建立订阅、启动定时器，并在不再需要时清理：

```jsx
import { useEffect, useState } from 'react';

export default function Timer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(value => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <p>已经过了{seconds}秒</p>;
}
```

这里的Effect在组件提交后启动定时器，卸载时停止定时器。如果Effect有依赖，依赖变化后还会先清理旧的副作用，再执行新的副作用。

`useLayoutEffect`会在DOM更新后、浏览器绘制前执行，适合测量布局。`useEffect`通常可以等到绘制后，但React18中由交互触发时也可能提前执行。[React18 Effect说明](https://legacy.reactjs.org/docs/hooks-reference.html#timing-of-effects)

开发环境开启StrictMode时，React18会额外检查渲染逻辑，并在首次挂载时执行一轮Effect的建立、清理和重新建立。上面的定时器有清理函数，因此不会多留一个定时器。[React18说明](https://react.dev/blog/2022/03/29/react-v18#new-strict-mode-behaviors)

## 各个阶段

```
render阶段计算变化
↓
commit开始
  → 修改DOM，改变内存中的页面结构、属性或文字
  → 执行useLayoutEffect
  → 同步commit结束
↓
JS交还主线程
↓
浏览器在合适的时机绘制新画面
```


