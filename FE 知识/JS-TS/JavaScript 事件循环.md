---
Description: 通过Promise和定时器的输出顺序，解释浏览器如何安排同步代码、微任务与后续任务。
Slug: javascript-event-loop
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
Published: false
Recommend: false
MeechoPolished: true
---

浏览器主线程上的JavaScript一次执行一段代码。定时器回调、Promise回调等，需要等到合适的时机再运行。

事件循环负责安排这些代码的执行顺序。下面讨论浏览器中的常见情况。

## 两类任务

| 类型 | 常见例子 |
| --- | --- |
| 任务，也常叫宏任务 | 脚本执行、定时器回调、点击事件 |
| 微任务 | `Promise.then`回调、`queueMicrotask`、`MutationObserver`回调 |

通常可以这样理解执行过程：

1. 执行当前任务中的同步代码。
2. 调用栈清空后，执行排队的微任务，直到微任务队列为空。
3. 浏览器有机会更新页面。
4. 继续执行下一个任务。

微任务执行时新加的微任务，也会在进入下一个任务前处理。页面渲染有自己的时机，不是每个任务结束后都一定发生。[MDN微任务说明](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)

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

`console.log('script')`是同步代码，所以先执行。

接着处理微任务。`then`回调先进入队列，`queueMicrotask`的回调后进入，所以依次输出promise和microtask。

最后才轮到定时器回调。`setTimeout(..., 0)`表示延迟为0，仍要等当前代码和微任务处理完，才有机会执行。
