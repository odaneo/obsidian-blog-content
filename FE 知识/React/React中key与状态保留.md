React用key识别同一组兄弟节点中的成员。列表增删或排序后，key帮助React找到原来的那一项。

## key怎样影响状态

在同一父节点下，key和组件类型相同，React通常会复用组件、保留状态，并根据新的props更新界面。

key或类型变化时，旧组件卸载，新组件挂载，状态重新初始化。[React协调文档](https://legacy.reactjs.org/docs/reconciliation.html)

## 数组下标为什么容易出错

```jsx
import { useState } from 'react';

export default function App() {
  const [items, setItems] = useState(['苹果', '香蕉', '橘子']);

  return (
    <div>
      {items.map((item, index) => (
        <label key={index}>
          <input type="checkbox" />
          {item}
        </label>
      ))}
      <button onClick={() => setItems(items.slice(1))}>
        删除第一项
      </button>
    </div>
  );
}
```

先勾选香蕉，再删除苹果：

```text
位置 | 删除前      | 删除后
0    | 苹果 未勾选 | 香蕉 未勾选
1    | 香蕉 已勾选 | 橘子 已勾选
2    | 橘子 未勾选 |
```

下标1原来对应香蕉，删除后对应橘子。React复用了这个位置的input，勾选状态也跟着保留。这里的input未传checked，属于由DOM保存勾选状态的非受控输入框。

这组名称唯一且不变，可以改用`key={item}`。业务数据通常使用稳定ID，如`key={item.id}`。下标更适合不会增删、排序的固定列表。[React列表文档](https://legacy.reactjs.org/docs/lists-and-keys.html#keys)

## 用key重置状态

假设计数器内部用`useState(0)`保存数字：

```jsx
<Counter key="same" label={showApple ? '苹果' : '香蕉'} />
```

只切换label会保留计数。要让不同水果分别从0开始，可以改变key：

```jsx
<Counter
  key={showApple ? 'apple' : 'banana'}
  label={showApple ? '苹果' : '香蕉'}
/>
```

旧Counter卸载并清理Effect，新Counter重新初始化。

