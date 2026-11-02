JavaScript会回收无法再访问的对象。数据已经不用，却仍被定时器、全局变量等引用时，就可能长期占用内存。[MDN内存管理](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management)

例如，图表已经关闭，定时器却还在读取它的数据，这份数据就可能一直保留。

## 常见原因

| 情况 | 处理方式 |
| --- | --- |
| 全局变量保留旧数据 | 不再使用时移除引用 |
| 定时器没有停止 | 清除不再需要的定时器 |
| window监听引用旧组件 | 组件卸载时移除监听 |
| 删除DOM后仍保存在数组里 | 清理相关引用 |
| 缓存只加不减 | 限制容量并清理过期项 |

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

这里使用同一个record函数添加和移除监听。stop会结束定时器和监听，并清空已记录的位置数据。

闭包本身不会必然造成泄漏。将变量设为`null`只会断开这一处引用，也不会立即触发垃圾回收。

## 怎样排查

在Chrome开发者工具的Memory面板中：

1. 页面稳定后拍一份堆快照。
2. 重复打开、关闭弹窗等同一组操作。
3. 再拍快照，比较持续增加的对象。
4. 查看引用链，定位没有清理的位置。

重点是已经用完的对象是否持续积累，而非内存是否出现过短暂上涨。[Chrome排查文档](https://developer.chrome.com/docs/devtools/memory-problems)
