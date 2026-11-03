---
Id: "3939e11c4a8e4133af3b174c74c34b0f"
Description: 记录博客如何把Notion内容同步到PostgreSQL和Cloudflare KV，再由Next.js读取缓存展示页面，并说明生产与本地环境的区别。
Slug: notion-driven-blog-data-flow-cache-design
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/Architecture|Architecture]]"
  - "[[SubTags/Nextjs|Nextjs]]"
  - "[[SubTags/前端性能优化|前端性能优化]]"
Published: true
Recommend: false
MeechoPolished: true
---

这个博客用Notion写文章，后端负责同步，前端负责展示。虽然现在已经全部迁移到了Obsidian上面，不再使用Notion了，但是之前的同步策略还是有记录一下的必要。

内容先整理好，存到Cloudflare KV里面，再交给前端读取。用户打开页面时，就不用等Notion或数据库现场查询。但同时也意味着，刚刚修改的内容，可能要等待最多8个小时才能反映到页面上。

## 后端同步内容

生产后端部署在AWS上，由.NET API、Hangfire定时任务和Node helper配合完成同步：

```text
Notion
→ Hangfire同步文章列表和分类
→ 保存到Supabase/PostgreSQL
→ Node helper读取正文并写入数据库
→ .NET生成JSON快照
→ 发布到Cloudflare KV
```

Hangfire每4小时执行一次同步。这里的Supabase提供PostgreSQL数据库，保存文章属性、分类和正文。

数据准备好后，后端生成首页、列表页和文章详情需要的JSON，再写入KV。最后更新`blog:active`，让前端找到当前发布的版本。

因此，后端平时主要做内容同步和发布，文章的日常浏览由前端缓存承担。

## 前端读取缓存

生产前端运行在Cloudflare Workers上，通过OpenNext适配Next.js。

页面缓存命中时，可以直接返回已有页面；需要生成或更新页面时，再读取KV里的文章数据：

```text
浏览器访问文章
→ 前端Worker检查页面缓存
→ 有可用页面就返回
→ 需要生成页面时读取KV
→ 渲染后返回
```

前端不直接查询Notion，也不直接访问PostgreSQL。数据库里的内容需要经过一次发布，才会成为前端读取的数据。

## 几层缓存各存什么

| 位置            | 保存的内容                        | 本项目的设置                                  |
| ------------- | ---------------------------- | --------------------------------------- |
| Cloudflare KV | 后端发布的文章JSON和版本信息             | 随内容同步更新                                 |
| KV边缘读取缓存      | 已经读过的KV数据                    | `blog:active`为30秒，文章和列表数据为300秒          |
| Next.js页面缓存   | 已经渲染好的页面                     | 文章页配置`revalidate = 14400`，由OpenNext存到R2 |
| 浏览器和CDN静态资源缓存 | `/_next/static/*`下的JS、CSS等文件 | 一年                                      |

例如，修改一篇文章后，先要等后端同步到KV，前端还可能继续使用已有的页面缓存。KV某个地区的读取缓存也可能暂时保留旧值。[KV一致性说明](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

`14400`秒是4小时。在本项目使用的ISR机制中，它表示页面达到重新验证的时间，并不保证每隔4小时准点刷新；后续访问会触发更新，更新期间仍可能返回旧页面。[Next.js ISR说明](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

所以，“后台每4小时同步一次”和“页面缓存4小时”是两个不同的等待环节。Notion刚保存成功，前端暂时没变化是可能的。

## 本地前端使用模拟数据

本地启动Next.js时，默认读取：

```text
src/utils/blog-cache/mock.ts
```

这样可以直接调页面、测试列表和空状态，不必先连接KV、数据库或后端。

本地页面显示的是模拟内容，也就不会自动反映生产博客的更新。

## 本地后端连接本地数据库

本地.NET API连接Docker里的PostgreSQL，配置与生产环境分开：

- 数据库地址指向localhost。
- Hangfire任务存储使用内存。
- Notion Token从本地配置读取。
- 默认不自动调用Node helper。

因此，当前本地同步流程不会自动拉取并写入完整文章正文。需要联调正文同步时，再单独启动并接上Node helper。
