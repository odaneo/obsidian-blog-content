组件首次显示是挂载，数据变化后重新计算界面是更新，从页面移除是卸载。以下按React18说明。

## 类组件的正常流程

```text
挂载
constructor → getDerivedStateFromProps → render → componentDidMount

更新
getDerivedStateFromProps → shouldComponentUpdate → render
→ getSnapshotBeforeUpdate → componentDidUpdate

卸载
componentWillUnmount
```

未定义的方法会跳过。`shouldComponentUpdate`返回false时，会跳过这次组件渲染。

| 方法 | 用途 |
| --- | --- |
| `constructor` | 调用super(props)后初始化state、绑定方法 |
| `getDerivedStateFromProps` | 少数需要根据props调整state的场景，挂载和更新时都会调用 |
| `shouldComponentUpdate` | 判断是否可以跳过渲染；PureComponent提供浅比较 |
| `render` | 根据props和state返回JSX |
| `getSnapshotBeforeUpdate` | DOM改动前读取滚动位置等信息，将结果交给componentDidUpdate |
| `componentDidMount` | 挂载后建立订阅或发起请求 |
| `componentDidUpdate` | 更新后处理变化，可读取之前的props和state |
| `componentWillUnmount` | 清除定时器、取消订阅 |

constructor和render不适合发请求或修改页面，渲染逻辑应保持纯净。[React类组件文档](https://legacy.reactjs.org/docs/react-component.html)

## 函数组件通过Effect处理副作用

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

Effect在提交后建立定时器，卸载时清理。有依赖时，依赖变化还会先清理旧Effect，再执行新Effect。

`useLayoutEffect`在DOM更新后、绘制前执行，适合测量布局。`useEffect`通常在绘制后执行，但交互触发时也可能提前。[React18 Effect说明](https://legacy.reactjs.org/docs/hooks-reference.html#timing-of-effects)

render阶段计算变化，commit阶段应用DOM改动并执行布局Effect。浏览器得到执行机会后，才会在合适时机绘制。

## StrictMode的开发检查

开发环境开启StrictMode时，React18会额外检查渲染逻辑，并在首次挂载时执行一轮Effect的建立、清理和重新建立。上例提供了清理函数，因此不会多留一个定时器。[React18说明](https://react.dev/blog/2022/03/29/react-v18#new-strict-mode-behaviors)


