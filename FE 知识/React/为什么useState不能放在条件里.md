---
Description: 用条件切换的例子解释React18如何按调用顺序保存Hook状态，以及useState应该放在哪里。
Slug: react18-usestate-hook-order
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

React18靠Hook的调用顺序，把这次的状态和上次的状态对应起来。它不会通过变量名识别哪个状态属于谁。

因此，条件变化后如果少调用或多调用一个`useState`，前后就可能对不上。

## 条件里调用会怎样

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

这段是错误写法。两次渲染的Hook顺序可能变成：

| 调用位置 | showName为true | showName为false |
| --- | --- | --- |
| 第一个Hook | name | age |
| 第二个Hook | age | 没有调用 |

React按照顺序读取旧状态，不知道第一个位置这次已经变成age，因此会出现Hook数量不一致等错误。

## 正确写法

让Hook每次都调用，把条件放在显示内容的地方：

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

同样，Hook不能放在循环或事件回调里，也不能先根据条件return，再调用Hook。它应在函数组件或自定义Hook的顶层调用。[React Hook规则](https://legacy.reactjs.org/docs/hooks-rules.html)

## 状态实际放在哪里

在React18.2.0的函数组件实现中，Fiber的`memoizedState`指向Hook链表。多个`useState`对应的Hook按调用顺序连接。

| 位置 | 保存什么 |
| --- | --- |
| Hook的`memoizedState` | 这个Hook的状态值 |
| Hook的`queue` | 状态更新队列 |
| 函数组件Fiber的`updateQueue` | Effect等信息，不是所有useState更新的统一队列 |

类组件则不同：Fiber的`memoizedState`保存整个state，`updateQueue`保存类组件的更新。
