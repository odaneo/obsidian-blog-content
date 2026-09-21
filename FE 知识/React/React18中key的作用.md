---
Description: 通过删除列表项和切换计数器的例子，说明React18如何用key识别组件，以及什么时候保留或重置状态。
Slug: react-key-usage
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

React18用key识别同一组兄弟节点中的成员。例如列表重新排序后，React需要知道哪一项还是原来的那一项。

## 什么时候保留状态

在同一父节点下，key相同且组件类型相同，React通常会复用原来的组件，保留它的state。组件内部仍会根据新的props更新界面。

如果key或组件类型变化，React会卸载旧组件，再挂载新组件，状态也会重新初始化。[React协调文档](https://legacy.reactjs.org/docs/reconciliation.html)

## 为什么数组下标容易出错

下面用数组下标作为key：

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
删除前           删除后
未勾选 苹果       未勾选 香蕉
已勾选 香蕉       已勾选 橘子
未勾选 橘子
```

原因是下标1原来代表香蕉，删除后代表橘子。React复用了这个位置的input，连同它的勾选状态一起保留了。

这里的input没有传`checked`，属于非受控输入框，勾选状态由DOM自己保存。

这组水果名称唯一且不变，可以改成`key={item}`。实际数据通常使用`key={item.id}`。只有列表固定、不会增删或排序时，下标才比较合适。[React列表文档](https://legacy.reactjs.org/docs/lists-and-keys.html#keys)

## 改key可以重置状态

假设计数器内部用`useState(0)`保存数字：

```jsx
<Counter key="same" label={showApple ? '苹果' : '香蕉'} />
```

切换label只会改名字，已有计数会保留。如果希望切换水果时从0开始，可以改变key：

```jsx
<Counter
  key={showApple ? 'apple' : 'banana'}
  label={showApple ? '苹果' : '香蕉'}
/>
```

旧Counter被卸载，新Counter重新初始化。旧Effect的清理函数也会执行。

