执行上下文记录代码运行需要的信息，例如参数、局部变量和执行位置。调用栈则记录哪些调用还没有结束，栈顶对应当前执行的代码。

## 函数怎样入栈和出栈

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

输出：

```text
a开始
b执行
a结束
脚本结束
```

下面用右侧表示栈顶：

| 执行位置 | 调用栈 |
| --- | --- |
| 开始执行脚本 | 脚本 |
| 调用a | 脚本 → a |
| a调用b | 脚本 → a → b |
| b返回 | 脚本 → a |
| a返回 | 脚本 |

每次调用函数，都会为这次调用准备执行上下文并压入栈中；返回后出栈，调用方继续运行。[MDN执行模型](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model)

## 调用顺序与作用域

变量查找先从当前作用域开始，再沿定义位置的外层作用域向外查找。

例如，b定义在a外面，即使由a调用，也不能直接读取a的局部变量。函数能够访问哪些变量，取决于定义位置，而非调用位置。

声明怎样初始化，见[[JavaScript变量提升与暂时性死区]]。
