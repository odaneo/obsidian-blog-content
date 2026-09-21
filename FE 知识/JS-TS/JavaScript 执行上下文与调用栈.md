---
Description: 用两个函数的调用过程解释执行上下文和调用栈，说明函数按什么顺序运行。
Slug: javascript-execution-context-and-stack
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
Published: false
Recommend: false
MeechoPolished: true
---

函数运行时，需要知道参数是什么、局部变量有哪些、执行到了哪里。这些运行信息由执行上下文管理。

调用栈记录当前有哪些函数还没执行完。最上面的函数正在执行，它返回后，下面的函数继续运行。

## 看一个调用过程

```javascript
function a() {
  console.log('a开始');
  b();
  console.log('a结束');
}

function b() {
  console.log('b执行');
}

a();
console.log('脚本结束');
```

输出顺序：

```text
a开始
b执行
a结束
脚本结束
```

可以把调用栈理解成叠起来的几层。下面用右侧表示栈顶：

| 执行到哪里 | 调用栈 |
| --- | --- |
| 开始运行脚本 | 脚本 |
| 调用a | 脚本 → a |
| a调用b | 脚本 → a → b |
| b返回 | 脚本 → a |
| a返回 | 脚本 |

调用函数时增加一层，函数返回时移除这一层。这就是入栈和出栈。[MDN执行模型](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model)

要注意的是 ，JavaScript在**准备**的时候，就会创建全局的执行上下文。执行到`a()` 时，又会创建a本次调用的执行上下文。详见 [JavaScript深入之执行上下文 · Issue #8 · mqyqingfeng/Blog](https://github.com/mqyqingfeng/Blog/issues/8)

全局执行上下文在脚本开始运行时创建并完成必要的初始化。函数执行上下文在每次调用函数时创建并完成必要的初始化，包括作用域链，然后才执行函数体。

## 词法作用域

函数先在自己的作用域里找变量，再沿着代码定义时的外层作用域查找，这条查找路径叫作用域链。

JavaScript是典型的词法作用域。例如，b写在a外面，即使由a调用，也不能直接读取a的局部变量。调用顺序和变量的可见范围是两回事。b能访问哪些变量，由它的定义位置决定，与在哪里调用它无关。

变量在执行前怎样准备，见[[JavaScript 全局与函数执行上下文]]。
