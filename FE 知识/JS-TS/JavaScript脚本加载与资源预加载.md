脚本加载分为下载和执行。下载是否影响HTML解析，与执行发生在什么时候，需要分开看。

## 普通脚本与defer和async

以下比较外部经典脚本：

| 写法 | 下载时 | 执行时 |
| --- | --- | --- |
| 不加属性 | 解析暂停并等待脚本 | 下载后执行，再继续解析 |
| `defer` | 与HTML解析并行 | 解析完成后，按标签顺序执行 |
| `async` | 与HTML解析并行 | 文件就绪后尽快执行，不保证顺序 |

```html
<script src="/app.js"></script>
<script src="/app.js" defer></script>
<script src="/analytics.js" async></script>
```

上面的三行展示不同选择，实际按需要选用。

依赖DOM或脚本顺序时，可使用`defer`；独立的统计脚本可以使用`async`。async脚本执行时仍可能暂停解析，defer脚本会在DOMContentLoaded前执行。

模块脚本默认延后到HTML解析完成后执行，通常无需再加defer。[MDN脚本说明](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script)

## preload与prefetch

| 方式 | 用途 |
| --- | --- |
| `preload` | 提前下载当前页面需要的资源，例如字体和重要图片 |
| `prefetch` | 提前获取后续导航可能需要的资源 |

```html
<link rel="preload" href="/fonts/custom.woff2"
      as="font" type="font/woff2" crossorigin>

<link rel="prefetch" href="/next-page.html">
```

这两个声明不会自行执行下载到的脚本，浏览器也可能按资源情况调整预取行为。[MDN预加载说明](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Speculative_loading)

## 页面预渲染

Speculation Rules可以声明可能打开的下一页：

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

预渲染会在后台准备页面，可能执行脚本，开销比单纯下载更大。是否执行还取决于浏览器支持和资源条件。[MDN预渲染说明](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)
