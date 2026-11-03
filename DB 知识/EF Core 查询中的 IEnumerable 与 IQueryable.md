---
Id: "4b32f862ef71462ca8813d0bc9e81bd2"
Description: 用查找成年用户的同一个例子，对比IQueryable让数据库筛选、IEnumerable让C#筛选的写法，解释数据在哪里处理，以及ToList什么时候执行查询。
Slug: ef-core-ienumerable-vs-iqueryable
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[SubTags/EFCore|EFCore]]"
Published: false
Recommend: false
MeechoPolished: true
---

同样一段Where，既可能由数据库筛选，也可能由C#逐条判断。在EF Core查询中，IQueryable和IEnumerable的区别，首先体现在数据在哪里处理。

假设Users表有三名用户：

| Id | Name | Age |
| --- | --- | --- |
| 1 | 小王 | 16 |
| 2 | 小李 | 20 |
| 3 | 小张 | 25 |

我们要查询Age大于或等于18的成年人。下面两种写法都会留下小李和小张，但从数据库取回的数据量不同。

## IQueryable交给数据库筛选

```csharp
IQueryable<User> users = db.Users;

var adults = users
    .Where(u => u.Age >= 18)
    .ToList();
```

User是对应用户记录的C#类，包含Id、Name和Age等属性。

users声明为IQueryable，Where便可以进入查询表达式。EF Core将这里的年龄条件翻译为SQL，由数据库完成筛选。

```text
告诉数据库：只要年龄大于或等于18的用户
                    ↓
数据库筛选出小李、小张
                    ↓
应用收到2条记录
```

应用只收到符合条件的2条记录，小王的数据不会传回来。

## IEnumerable交给C#筛选

只改第一行的接口类型：

```csharp
IEnumerable<User> users = db.Users;

var adults = users
    .Where(u => u.Age >= 18)
    .ToList();
```

此时调用的是Enumerable的Where方法。年龄判断在C#中执行，不会加入这次数据库查询。

```text
数据库返回小王、小李、小张
                    ↓
C#检查每个人的年龄
                    ↓
留下小李、小张
```

最终仍是2人，但应用先接收了3人的数据。

表中若有10万名用户，仅100人符合条件，这个差距就会放大：

| 示例 | 执行年龄判断的位置 | 数据库返回的记录数 |
| --- | --- | --- |
| IQueryable | 数据库 | 100条 |
| IEnumerable | C#应用 | 10万条 |

声明为IEnumerable，并不表示数据已经加载到内存。这个例子的查询源仍是db.Users，只是后续年龄筛选留在了应用端。[EF Core客户端求值](https://learn.microsoft.com/en-us/ef/core/querying/client-eval)

## ToList才取回结果

两段代码在第一行赋值时都没有访问数据库。执行ToList后，查询才被枚举，最终结果收集为列表。

日常代码通常省略接口声明，直接写成：

```csharp
var adults = await db.Users
    .Where(u => u.Age >= 18)
    .ToListAsync();
```

年龄条件仍由数据库执行。ToListAsync完成后，adults才是应用可以使用的结果列表。
