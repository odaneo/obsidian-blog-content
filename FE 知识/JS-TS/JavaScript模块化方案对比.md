模块化把代码拆成多个文件，再通过导入、导出共享函数和数据。

| 方案 | 常见环境 | 主要写法 |
| --- | --- | --- |
| CommonJS | Node.js | `require`、`module.exports` |
| ESM | 浏览器和Node.js | `import`、`export` |
| AMD | 使用RequireJS的浏览器项目 | 提前列出依赖 |
| CMD | 使用Sea.js的浏览器项目 | 在使用位置写`require` |

## CommonJS

CommonJS同步加载模块，用`module.exports`导出接口：

```javascript
// math.cjs
module.exports = {
  add: (a, b) => a + b
};

// main.cjs
const math = require('./math.cjs');
console.log(math.add(2, 3)); // 5
```

`.cjs`明确指定CommonJS格式。[Node.js文档](https://nodejs.org/api/modules.html)

## ESM

ESM是JavaScript的标准模块方案：

```javascript
// math.mjs
export const add = (a, b) => a + b;

// main.mjs
import { add } from './math.mjs';
console.log(add(2, 3)); // 5
```

静态`import`便于提前分析依赖，结合构建工具可以移除未使用的代码。运行时按需加载则使用异步的`import()`。

Node.js可使用`.mjs`，或在package.json中设置`"type": "module"`后使用`.js`。浏览器用`<script type="module">`加载入口。[Node.js ESM文档](https://nodejs.org/api/esm.html)

## AMD

RequireJS取得依赖后执行回调：

```javascript
require(['./math'], function (math) {
  console.log(math.add(2, 3));
});
```

math模块也要用AMD的`define`格式提供接口。[RequireJS文档](https://requirejs.org/docs/api.html)

## CMD

Sea.js允许在使用位置取得模块接口：

```javascript
define(function (require, exports, module) {
  const math = require('./math');
  console.log(math.add(2, 3));
});
```

它会提前分析、下载依赖，`require`的位置不等于文件下载时机。需要延后发起加载时，使用`require.async`。[Sea.js文档](https://github.com/seajs/seajs/issues/259)
