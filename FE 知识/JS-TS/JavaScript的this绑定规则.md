普通函数的`this`主要由调用方式决定；箭头函数沿用定义位置外层的`this`。

## 直接调用

严格模式下，直接调用普通函数，`this`是`undefined`：

```javascript
function show() {
  'use strict';
  console.log(this);
}

show(); // undefined
```

浏览器中非严格模式的普通函数，直接调用时的`this`通常是`window`。

## 通过对象调用

```javascript
const person = {
  name: 'Alice',
  greet() {
    console.log(this.name);
  }
};

person.greet(); // Alice
```

`person.greet()`中的`this`是person。如果先取出`const greet = person.greet`，再执行`greet()`，就变成直接调用，函数不会一直绑定原来的对象。

## 显式绑定

`call`和`apply`立即调用函数，`bind`返回绑定后的新函数。

```javascript
function say(message) {
  console.log(this.name + message);
}

const person = { name: 'Bob' };

say.call(person, '你好');    // Bob你好
say.apply(person, ['你好']); // Bob你好

const greet = say.bind(person, '你好');
greet(); // Bob你好
```

`call`逐个传参，`apply`通过数组传参。

## 使用new

```javascript
function Person(name) {
  this.name = name;
}

const person = new Person('Charlie');
console.log(person.name); // Charlie
```

执行构造函数时，`this`指向新创建的对象。

## 箭头函数

```javascript
const person = {
  name: 'David',
  greet() {
    const show = () => {
      console.log(this.name);
    };

    show();
  }
};

person.greet(); // David
```

内部的show沿用greet本次调用的`this`，所以输出David。

如果把greet直接写成箭头函数，它会沿用对象外层的`this`。`call`、`apply`和`bind`也无法改变箭头函数的`this`。[MDN的this说明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
