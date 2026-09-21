---
Description: 用表格区分普通脚本、defer和async，再说明preload、prefetch与页面预渲染分别解决什么问题。
Slug: javascript-script-loading
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
  - "[[SubTags/前端性能优化|前端性能优化]]"
Published: false
Recommend: false
MeechoPolished: true
---

加载脚本有两个步骤：先下载文件，再执行代码。下载时是否暂停HTML解析，与什么时候执行，是两个问题。

## 脚本什么时候执行

下面比较HTML中的外部普通脚本：

| 写法      | 下载时           | 执行时               |
| ------- | ------------- | ----------------- |
| 不加属性    | HTML解析暂停并等待脚本 | 下载后执行，执行完继续解析     |
| `defer` | 下载和HTML解析同时进行 | HTML解析完成后，按标签顺序执行 |
| `async` | 下载和HTML解析同时进行 | 文件就绪后尽快执行，不保证顺序   |

```html
<script src="/app.js"></script>
<script src="/app.js" defer></script>
<script src="/analytics.js" async></script>
```

以上是三种写法的对比，实际按需要选择。

依赖页面元素，或要求多个脚本按顺序运行时，可用`defer`。独立的统计脚本可用`async`，但它执行时仍可能暂停HTML解析。`defer`脚本会在`DOMContentLoaded`事件前执行。

`<script type="module">`默认也会等HTML解析完成再执行，无需再加`defer`。[MDN脚本说明](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script)

## 提前准备资源

| 方式 | 准备什么 | 适合什么场景 |
| --- | --- | --- |
| `preload` | 当前页面需要的资源 | 提前下载字体或重要图片 |
| `prefetch` | 后续可能用到的资源 | 提前下载下一页资源 |
| 预渲染 | 下一页及其页面内容 | 提前准备用户很可能打开的页面 |

`preload`和`prefetch`负责下载资源，不会仅凭这两个声明就执行脚本。[MDN预加载说明](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Speculative_loading)

```html
<link rel="preload" href="/fonts/custom.woff2"
      as="font" type="font/woff2" crossorigin>

<link rel="prefetch" href="/next-page.html">
```

页面预渲染可通过Speculation Rules API声明：

```html
<script type="speculationrules">
{
  "prerender": [{
    "source": "list",
    "urls": ["/about"]
  }]
}
</script>
```

它会在后台准备整个页面，可能执行页面脚本，开销也更大。浏览器支持情况不同，也可能因资源限制跳过预渲染。[MDN预渲染说明](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)
