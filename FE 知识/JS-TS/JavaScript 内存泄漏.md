---
Description: 用定时器和事件监听的例子说明内存为什么无法释放，以及怎样通过浏览器快照排查。
Slug: javascript-memory-leaks
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
Published: false
Recommend: false
MeechoPolished: true
---

JavaScript会自动回收无法再被程序访问的对象。

内存泄漏常见的情况是：数据已经不用了，但程序里还有引用指向它，导致它一直留在内存中。[MDN内存管理](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)

例如，页面关闭了一个图表，后台定时器却还在读取图表数据，这份数据就可能一直无法释放。

## 常见原因

| 情况             | 为什么留在内存里    | 处理方式       |
| -------------- | ----------- | ---------- |
| 全局变量保存旧数据      | 全局变量仍能访问它   | 不再使用时移除引用  |
| 定时器没有停止        | 回调还在使用旧数据   | 清除不再需要的定时器 |
| window上的监听没有移除 | 回调仍引用旧组件或数据 | 组件卸载时移除监听  |
| 删除DOM后仍保存它     | 数组等对象还引用该元素 | 同时清理相关引用   |
| 缓存只加不减         | 旧数据一直存在缓存中  | 限制容量并清理过期项 |

## 用完后清理

```javascript
function startTracking() {
  const positions = [];

  function record() {
    positions.push(window.scrollY);
  }

  const timer = setInterval(record, 1000);
  window.addEventListener('scroll', record);

  return function stop() {
    clearInterval(timer);
    window.removeEventListener('scroll', record);
    positions.length = 0;
  };
}

const stopTracking = startTracking();

// 不再需要记录时调用，例如组件卸载时
stopTracking();
```

这里用同一个`record`函数添加和移除监听。停止定时器并移除监听后，回调不再运行，再清空数组中的旧记录。

闭包本身是正常功能；保留了不再需要的数据才是问题。大对象也不必一律设为`null`：只要无法再被访问，就可以被回收。`null`只能断开当前引用，不会让垃圾回收立刻发生。

## 怎样排查

在Chrome开发者工具的Memory面板中：

1. 页面稳定后拍一份堆快照。
2. 反复执行同一组操作，例如打开再关闭弹窗。
3. 再拍快照，比较哪些对象数量持续增加。
4. 查看这些对象被谁引用，定位没有清理的位置。

内存短暂上涨很正常。更值得检查的是：重复操作后，已经用完的对象仍不断积累。[Chrome排查文档](https://developer.chrome.com/docs/devtools/memory-problems)
