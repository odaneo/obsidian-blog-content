---
Description: 用五种调用方式解释this指向谁，并说明普通函数和箭头函数的区别。
Slug: javascript-this-binding-cases
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
Published: false
Recommend: false
MeechoPolished: true
---

普通函数的`this`主要由调用方式决定。箭头函数没有自己的`this`，它沿用定义位置外层的`this`。

## 直接调用函数

严格模式下，直接调用普通函数，`this`是`undefined`：

```javascript
function show() {
  'use strict';
  console.log(this);
}

show(); // undefined
```

如果是浏览器中非严格模式的普通函数，这种调用的`this`通常是`window`。

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

`person.greet()`通过person调用方法，所以这次调用的`this`是person。

如果先写`const greet = person.greet`，再调用`greet()`，就变成了直接调用函数。`this`不会因为函数原来放在person里，就一直指向person。

## 指定this

`call`和`apply`会立即调用函数。`bind`返回一个绑定了`this`的新函数，等后续调用。

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

`call`把参数逐个传入，`apply`把参数放在数组中传入。

## 使用new

```javascript
function Person(name) {
  this.name = name;
}

const person = new Person('Charlie');
console.log(person.name); // Charlie
```

`new`会创建一个对象。执行构造函数时，`this`指向这个新对象。

## 箭头函数沿用外层this

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

这次greet的`this`是person，内部的箭头函数沿用它，所以输出David。

如果直接把greet写成`greet: () => { ... }`，箭头函数会使用对象外层的`this`。把箭头函数放进对象，不会让它获得这个对象作为`this`。

`call`、`apply`和`bind`也不能改变箭头函数使用的`this`。[MDN this说明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
