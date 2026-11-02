代码执行前，运行环境会准备变量和函数声明，但不同声明的可用时机不同。

## var与函数声明

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

刚进入函数时，参数a已经取得传入值；b和d已初始化为`undefined`；函数声明c已经可用。

执行到赋值语句时，b才变成2，d才得到函数。所谓变量提升，可以理解为声明提前准备，赋值仍按代码顺序发生。[MDN的var说明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var)

## let与const

```javascript
function demo() {
  console.log(count); // ReferenceError
  let count = 1;
}

demo();
```

在当前作用域内，`let`和`const`的绑定要等执行到声明处才完成初始化。此前访问会报错，这段范围叫暂时性死区。

| 声明方式 | 执行到声明语句前 |
| --- | --- |
| `var` | 可读取，初始值为`undefined` |
| 函数声明 | 通常已可调用 |
| `let`、`const` | 访问未初始化绑定会报错 |

普通的`const`声明还要同时赋值，例如`const count = 1`。[MDN声明规则](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types)

## 全局与函数作用域

普通脚本的顶层代码在全局环境运行，每次函数调用都有自己的参数和局部变量。浏览器顶层的`let`、`const`不会成为`window`属性，ES模块还有独立的模块作用域。

函数返回后，如果闭包仍引用局部数据，这些数据可以继续保留。执行过程见[[JavaScript执行上下文与调用栈]]。
