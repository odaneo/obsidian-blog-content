---
Description: 用查找成年用户的同一个例子，对比IQueryable让数据库筛选、IEnumerable让C#筛选的写法，解释数据在哪里处理，以及ToList什么时候执行查询。
Slug: ef-core-ienumerable-vs-iqueryable
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[EFCore]]"
Published: false
Recommend: false
MeechoPolished: true
---

假设数据库里有一张Users表：

| Id | Name | Age |
| --- | --- | --- |
| 1 | 小王 | 16 |
| 2 | 小李 | 20 |
| 3 | 小张 | 25 |

现在只想查出成年人，也就是Age大于或等于18的用户。

下面两段代码都能得到小李和小张，但筛选的位置不同。这里讨论的是EF Core查询数据库的用法。

## IQueryable在数据库中筛选

```csharp
IQueryable<User> users = db.Users;

var adults = users
    .Where(u => u.Age >= 18)
    .ToList();
```

这里的User是表示用户的C#类，包含Id、Name、Age等属性。

users使用IQueryable类型，后面的Where条件可以交给EF Core翻译成SQL，让数据库执行。

过程是：

```text
告诉数据库：只要年龄大于或等于18的用户
                    ↓
数据库筛选出小李、小张
                    ↓
应用收到2条记录
```

小王不满足条件，因此不会作为查询结果传给应用。

## IEnumerable在C#中筛选

把第一行的类型换成IEnumerable：

```csharp
IEnumerable<User> users = db.Users;

var adults = users
    .Where(u => u.Age >= 18)
    .ToList();
```

这时，后面的Where使用C#的集合筛选方法，不会把年龄条件加进数据库查询。

过程变成：

```text
数据库返回小王、小李、小张
                    ↓
C#检查每个人的年龄
                    ↓
留下小李、小张
```

结果仍然是2个人，但3条记录都需要从数据库传过来。

如果表里有10万名用户，其中只有100人符合条件，区别就更明显：

| 写法 | 在哪里判断年龄 | 需要从数据库传回多少条记录 |
| --- | --- | --- |
| IQueryable示例 | 数据库 | 100条 |
| IEnumerable示例 | C#程序 | 10万条 |

IEnumerable不代表数据已经在内存里。上面的users仍然来自数据库，只是年龄筛选改由C#完成。[EF Core客户端求值说明](https://learn.microsoft.com/en-us/ef/core/querying/client-eval)

## ToList执行查询

在这两个例子中，第一行赋值时都还没有查询数据库。执行到ToList时，才会取出数据，并把最终结果保存为列表。

代码里也经常不明确写出接口类型，而是直接这样查询：

```csharp
var adults = await db.Users
    .Where(u => u.Age >= 18)
    .ToListAsync();
```

这里的年龄条件仍然交给数据库处理，查询完成后，adults才是一份可以在C#中使用的结果列表。