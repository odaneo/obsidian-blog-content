---
Description: 用对象和数组的更新例子说明React18为什么需要不可变状态，以及怎样复制真正发生变化的部分。
Slug: react18-immutable-state
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

在React18中，不可变状态的意思是：更新对象或数组时，创建新值并交给React，保留之前那份数据。

## 对象怎么更新

假设state里保存一个用户：

```javascript
const [user, setUser] = useState({ name: '小王', age: 20 });
```

直接修改原对象容易出问题：

```javascript
user.age = 21;
setUser(user);
```

前后的user仍是同一个对象。React使用`Object.is`比较新旧state，遇到相同引用时可能跳过更新，页面就可能没有变化。

改成创建新对象：

```javascript
setUser(previous => ({
  ...previous,
  age: 21
}));
```

`...previous`复制原来的字段，再用新的age覆盖旧值。

## 数组怎么更新

```javascript
// 添加
setItems(previous => [...previous, newItem]);

// 删除
setItems(previous => previous.filter(item => item.id !== targetId));

// 修改
setItems(previous => previous.map(item =>
  item.id === targetId ? { ...item, name: '新名称' } : item
));
```

这些操作都会产生新数组。没有变化的数组成员可以继续复用。

## 嵌套对象也要复制

展开运算符只复制一层。修改内部对象时，内部那一层也需要新建：

```javascript
setUser(previous => ({
  ...previous,
  address: {
    ...previous.address,
    city: '上海'
  }
}));
```

这不要求把所有数据都深拷贝，只需要复制从被修改的位置到最外层之间的对象。

## 为什么这样更可靠

旧数据保留下来，前一次渲染看到的内容就不会被后续代码偷偷改掉。这也适合React18可能暂停或重新开始的并发渲染。

新旧引用有区别，还方便`React.memo`和`PureComponent`进行浅比较。`useMemo`则是根据依赖决定是否复用计算结果，本身不负责阻止组件渲染。[React Hooks文档](https://legacy.reactjs.org/docs/hooks-reference.html)、[React性能文档](https://legacy.reactjs.org/docs/optimizing-performance.html#the-power-of-not-mutating-data)
