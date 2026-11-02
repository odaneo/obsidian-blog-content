浏览器主线程上的JavaScript一次执行一段代码。事件循环安排同步代码结束后，哪些回调接着运行。

## 任务与微任务

| 类型 | 常见例子 |
| --- | --- |
| 任务，也常称宏任务 | 脚本执行、定时器回调、点击事件 |
| 微任务 | Promise回调、`queueMicrotask`、MutationObserver回调 |

常见执行顺序是：

1. 执行当前任务的同步代码。
2. 调用栈清空后，处理微任务，直到队列为空。
3. 浏览器在合适的时机更新页面。
4. 执行下一个任务。

微任务中新加入的微任务，也会在下一个任务前处理。渲染有自己的时机，并非每个任务结束后都会发生。[MDN微任务说明](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)

## 看输出顺序

```javascript
setTimeout(() => console.log('timeout'), 0);

Promise.resolve().then(() => console.log('promise'));

queueMicrotask(() => console.log('microtask'));

console.log('script');
```

输出：

```text
script
promise
microtask
timeout
```

同步代码先输出script。随后按入队顺序执行两个微任务，最后才轮到定时器。`setTimeout(..., 0)`也要等待当前代码和微任务完成，才有机会执行。
