React按Hook调用顺序，把本次状态与上次状态对应起来。条件改变后，多调用或少调用一个useState，就可能发生错位。

## 错误写法

```jsx
import { useState } from 'react';

function UserForm({ showName }) {
  if (showName) {
    const [name, setName] = useState('');
  }

  const [age, setAge] = useState(18);
  return <p>{age}</p>;
}
```

两次渲染的顺序可能变成：

| 位置 | showName为true | showName为false |
| --- | --- | --- |
| 第一个Hook | name | age |
| 第二个Hook | age | 未调用 |

React会按原顺序读取状态，因此可能报出Hook数量不一致等错误。

## 保持调用顺序

每次都调用Hook，把条件放在显示内容中：

```jsx
import { useState } from 'react';

function UserForm({ showName }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState(18);

  return (
    <div>
      {showName && (
        <input value={name} onChange={event => setName(event.target.value)} />
      )}
      <p>年龄：{age}</p>
      <button onClick={() => setAge(value => value + 1)}>长一岁</button>
    </div>
  );
}
```

useState等Hook应在函数组件或自定义Hook的顶层调用，放在条件返回之前，避免放入循环、条件或事件回调。[Hook调用规则](https://legacy.reactjs.org/docs/hooks-rules.html)

## 状态存在哪里

在React18.2.0中，函数组件Fiber的memoizedState指向Hook链表，按调用顺序连接。

| 位置 | 内容 |
| --- | --- |
| Hook的memoizedState | 对应状态值 |
| Hook的queue | 对应状态更新队列 |
| 函数组件Fiber的updateQueue | Effect等信息 |

各个useState有自己的更新队列。类组件则由Fiber的memoizedState保存整个state，updateQueue保存类组件更新。
