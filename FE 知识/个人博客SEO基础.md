---
Description: 从标题、页面描述、规范地址、结构化数据和站点地图入手，说明个人博客怎样让搜索引擎更容易发现和理解文章。
Slug: engineering-seo-guidelines
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/SEO|SEO]]"
  - "[[SubTags/Nextjs|Nextjs]]"
Published: false
Recommend: false
MeechoPolished: true
---

一篇文章写完后，还需要让搜索引擎知道：它讲什么，正式地址是哪一个，以及最近有没有更新。

个人博客的SEO，可以先把下面几件事做好。

## 标题和正文对应

文章页用一个清楚的`h1`显示文章标题，主要章节用`h2`，章节里的小节再用`h3`。网站名称放在导航或页头即可。

标题层级用来表达内容结构，不必为了字号大小随意跳级，样式可以交给CSS。

`sr-only`这类隐藏样式适合提供屏幕阅读器所需的辅助文字，不应拿来堆放用户看不到的关键词。[Google说明](https://developers.google.com/search/docs/essentials/spam-policies#hidden-text-and-link-abuse)

## 每页写自己的描述

页面的`title`和`description`应说明这一页的内容。文章页写文章的主题，标签页写这个主题下有哪些内容。

例如：

```text
标题：前端文件缓存入门
描述：用网页更新的例子解释强缓存、协商缓存和文件哈希。
```

描述用一两句话说清内容即可，不需要硬凑固定字数。Google可能采用这段描述，也可能从正文中另选摘要。[摘要说明](https://developers.google.com/search/docs/appearance/snippet)

## 给文章一个规范地址

同一篇文章可能通过不同地址访问：

```text
https://example.com/posts/cache
https://example.com/posts/cache?from=homepage
```

如果内容相同，可以用`canonical`声明希望搜索引擎采用的正式地址。

Next.js的页面可以通过Metadata设置：

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "前端文件缓存入门",
  description: "用网页更新的例子解释强缓存、协商缓存和文件哈希。",
  alternates: {
    canonical: "https://example.com/posts/cache",
  },
};
```

有中英文等对应版本时，再用`hreflang`说明语言关系。`canonical`用于说明规范地址，`hreflang`用于对应语言版本，两者各有用途。

## 用JSON-LD说明文章信息

JSON-LD是一段放在页面里的结构化数据，方便搜索引擎识别文章标题、作者和日期。

普通博客可以使用`BlogPosting`，例如：

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "前端文件缓存入门",
  "description": "用网页更新的例子解释强缓存、协商缓存和文件哈希。",
  "url": "https://example.com/posts/cache",
  "author": {
    "@type": "Person",
    "name": "作者名称",
    "@id": "https://example.com/#author"
  }
}
```

这段数据放入`type="application/ld+json"`的script标签。示例中的域名和作者需要换成自己的；有真实的发布时间和修改时间时，再补上`datePublished`和`dateModified`。

字段含义应与页面内容一致。同一个作者可以复用同一个`@id`；有面包屑导航时，可以另加`BreadcrumbList`。这些标记有助于理解页面，但不保证排名或搜索展示效果。[文章结构化数据](https://developers.google.com/search/docs/appearance/structured-data/article)

如果数据来自文章内容，写入script标签前还需要安全处理，不能直接拼接未经处理的字符串。[Next.js示例](https://nextjs.org/docs/app/guides/json-ld)

## 站点地图列出正式页面

站点地图通常叫`sitemap.xml`，也可以沿用项目里的`server-sitemap.xml`。

里面列出希望被收录的正式地址，例如首页、文章页和有实际内容的标签页。草稿、后台页面和重复参数地址不用放进去。

`lastmod`填写页面内容实际发生重要更新的时间，不要每次生成地图都改成当前时间。Google会忽略`priority`和`changefreq`，它们不能控制Google的抓取频率。[站点地图说明](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

## robots.txt保留必要资源

robots.txt告诉爬虫哪些路径允许抓取，并提供站点地图地址。Next.js可以在`app/robots.ts`中配置：

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: "https://example.com/server-sitemap.xml",
  };
}
```

这里假设`/api/`里的接口无需收录，站点地图也确实存在。不要直接屏蔽整个`/_next/`，否则可能阻止爬虫读取渲染页面需要的JS和CSS。[Google抓取说明](https://developers.google.com/search/docs/fundamentals/get-started)

robots.txt也不负责保护后台。需要登录才能看的内容，仍由服务端检查权限。

配置完成后，可以在Google Search Console提交站点地图，再检查具体文章的抓取和索引状态。
