---
Description: 对比CommonJS、ESM、AMD和CMD的写法，用简单例子说明模块怎样导出、导入和加载。
Slug: javascript-module-systems
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
Published: false
Recommend: false
MeechoPolished: true
---

模块化就是把代码拆成多个文件，再导入需要的函数或数据。例如，把加法函数放在一个文件里，其他文件直接调用。

## 四种方案

| 方案 | 常见环境 | 主要写法 |
| --- | --- | --- |
| CommonJS | Node.js | `require`和`module.exports` |
| ESM | 浏览器和Node.js | `import`和`export` |
| AMD | 使用RequireJS的浏览器项目 | 提前列出依赖 |
| CMD | 使用Sea.js的浏览器项目 | 在使用处写`require` |

## CommonJS

`module.exports`提供接口，`require`取得接口。加载CommonJS模块是同步的，当前代码会等模块准备好再继续。

```javascript
// math.cjs
module.exports = {
  add: (a, b) => a + b
};

// main.cjs
const math = require('./math.cjs');
console.log(math.add(2, 3)); // 5
```

这里用`.cjs`明确告诉Node.js按CommonJS运行。[Node.js文档](https://nodejs.org/api/modules.html)

## ESM

ESM是JavaScript的标准模块方案。`export`导出，`import`导入。

```javascript
// math.mjs
export const add = (a, b) => a + b;

// main.mjs
import { add } from './math.mjs';
console.log(add(2, 3)); // 5
```

静态`import`让工具在运行前就能分析模块依赖，也方便打包时去掉未使用的代码。需要运行时再加载某个模块，可以用异步的`import()`。

Node.js可用`.mjs`，也可在`package.json`中设置`"type": "module"`后使用`.js`。浏览器通过`<script type="module">`加载入口。[Node.js文档](https://nodejs.org/api/esm.html)

## AMD

AMD把依赖写在前面。RequireJS异步取得依赖后，再执行回调。

```javascript
require(['./math'], function (math) {
  console.log(math.add(2, 3));
});
```

这里的`math`也需要按AMD格式定义，比如用`define`返回一个带有`add`方法的对象。[RequireJS文档](https://requirejs.org/docs/api.html)

## CMD

CMD允许把依赖写在用到它的位置。

```javascript
define(function (require, exports, module) {
  const math = require('./math');
  console.log(math.add(2, 3));
});
```

Sea.js会提前分析并下载依赖文件，执行到`require`时再取得模块接口。因此，`require`写在后面，不代表文件也到那时才下载。需要延后发起加载时，用`require.async`。[Sea.js文档](https://github.com/seajs/seajs/issues/259)
