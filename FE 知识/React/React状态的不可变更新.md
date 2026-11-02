更新对象或数组状态时，创建新值交给React，并保留之前的数据。

## 更新对象

假设状态是：

```javascript
const [user, setUser] = useState({ name: '小王', age: 20 });
```

直接修改原对象容易出问题：

```javascript
user.age = 21;
setUser(user);
```

React使用Object.is比较新旧state。相同引用可能让更新被跳过，页面不一定变化。

改成创建新对象：

```javascript
setUser(previous => ({
  ...previous,
  age: 21
}));
```

展开原字段，再覆盖age。

## 更新数组

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

这些操作产生新数组，没有变化的成员仍可复用。

## 更新嵌套对象

展开运算符只复制一层，修改嵌套字段时，需要复制到被修改的位置：

```javascript
setUser(previous => ({
  ...previous,
  address: {
    ...previous.address,
    city: '上海'
  }
}));
```

复制变化路径上的对象即可，无须把所有数据深拷贝。

保留旧数据可以避免改写之前渲染使用的状态，也便于React.memo和PureComponent进行浅比较。useMemo按依赖缓存计算结果，本身不阻止组件渲染。[React性能说明](https://legacy.reactjs.org/docs/optimizing-performance.html#the-power-of-not-mutating-data)
