---
Description: 用函数例子解释参数、var、let和const在执行前的准备过程，说明变量提升和暂时性死区。
Slug: javascript-global-and-function-context
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
Published: false
Recommend: false
MeechoPolished: true
---

执行上下文是代码运行时使用的环境信息。这里主要看两件事：代码在哪里运行，变量什么时候可以使用。

## 全局和函数的区别

普通脚本的顶层代码在全局执行上下文中运行。每调用一次函数，就会创建这次调用的函数执行上下文，管理它的参数、局部变量等信息。

例如，同一个函数调用两次，就有两次独立的运行环境。

浏览器的全局对象是`window`，但它不等于执行上下文。顶层的`let`和`const`不会变成`window`的属性；ES模块还有自己的模块作用域。[MDN执行模型](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model)、[let说明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let)

## 执行前会准备什么

```javascript
function foo(a) {
  console.log(a);        // 1
  console.log(b);        // undefined
  console.log(typeof c); // function
  console.log(d);        // undefined

  var b = 2;
  function c() {}
  var d = function () {};

  console.log(b);        // 2
  console.log(typeof d); // function
}

foo(1);
```

刚进入函数时，参数a已经取得传入的值。b和d也已经准备好，但值还是`undefined`。函数声明c则已经可以调用。

代码执行到`var b = 2`时，b才被赋值为2。执行到d的赋值语句时，d才得到那个函数。

这就是变量提升的关键：`var`声明提前准备，赋值仍按代码顺序发生。[MDN变量提升](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var)

## let和const有什么不同

```javascript
function demo() {
  console.log(count); // ReferenceError
  let count = 1;
}

demo();
```

在当前作用域里，`let`和`const`声明的变量要等代码执行到声明处，才能使用。此前的这段范围叫暂时性死区。

| 声明方式 | 执行到声明语句前 |
| --- | --- |
| `var` | 可以读取，值是`undefined` |
| 函数声明 | 可以调用 |
| `let`和`const` | 读取会报错 |

普通的`const`声明还必须直接赋值，例如`const count = 1`。[MDN声明规则](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types)

函数返回时会从调用栈移除。但如果闭包还需要它的局部变量，相关数据仍可能保留，具体何时回收由垃圾回收器决定。
