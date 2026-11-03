---
Id: "ac97302f7873443393a0512f64e8baf3"
Description: 从 SQL、返回数据量和数据库往返入手，介绍 EF Core 的投影、无跟踪查询、分页、批量更新与索引优化，分清哪些优化需要结合实际负载验证。
Slug: ef-core-query-and-write-performance
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[SubTags/EFCore|EFCore]]"
Published: false
Recommend: false
MeechoPolished: true
---

EF Core接口响应变慢，先看看一次请求到底执行了哪些SQL。常见原因是读取过多数据、反复访问数据库，或缺少适合当前查询的索引。找到这些原因，再选择优化方法。

本文使用关系型数据库提供程序。ExecuteUpdateAsync和ExecuteDeleteAsync需要EF Core 7或更高版本，EF Core 8也支持。

## 先观察SQL

ToQueryString可以查看查询将被翻译成什么SQL：

```csharp
var query = db.Users.Where(user => user.IsActive);
Console.WriteLine(query.ToQueryString());
```

它有助于理解查询，但不会告诉你真实耗时。结合EF Core日志和数据库执行计划，才能确认调用次数、执行时间，以及扫描了多少数据。

## 只查询页面所需的数据

用户列表只展示编号和姓名，就只返回这两个字段，并在数据库中限制数量：

```csharp
var users = await db.Users
    .Where(user => user.IsActive)
    .OrderBy(user => user.Id)
    .Select(user => new { user.Id, user.Name })
    .Take(50)
    .ToListAsync();
```

头像、大段介绍等字段不必随列表返回。筛选和分页也应尽量放在ToList之前，否则应用可能已经取回了大量无用数据。

如果页面只需要不断点击“下一页”，深分页时可以考虑游标方式。例如按唯一Id筛选Id > lastId，排序后取下一批。它与任意跳到某一页的交互不同，应根据页面需求选择。[EF Core高效查询](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying)

## 只读实体减少跟踪

默认查询会让DbContext跟踪实体，记录其状态，供后续保存使用。只读页面不需要修改这些实体时，可以使用AsNoTracking：

```csharp
var users = await db.Users
    .AsNoTracking()
    .Where(user => user.IsActive)
    .Take(50)
    .ToListAsync();
```

省去跟踪可以减少相关开销，但收益仍取决于结果数量和实体重复情况。

如果Select仅返回字符串、数字等值，没有包含实体，就没有实体需要跟踪。需要修改对象并调用SaveChanges时，保留跟踪则更方便。[跟踪查询与无跟踪查询](https://learn.microsoft.com/en-us/ef/core/querying/tracking)

## 避免逐条查询关联数据

先取订单，再为每张订单单独查明细，容易产生N+1查询。页面只要数量或金额时，用Select投影；确实需要关联实体时，再使用Include。

一次加载多个集合可能让联表结果出现大量重复数据，也要结合实际SQL评估。例子见[[EF Core N+1 查询问题]]。

## 成批更新和删除

统一停用长期未登录的用户，可以直接让数据库更新符合条件的记录：

```csharp
var cutoff = DateTime.UtcNow.AddYears(-2);

var affected = await db.Users
    .Where(user => user.LastLoginAt < cutoff && user.IsActive)
    .ExecuteUpdateAsync(setters =>
        setters.SetProperty(user => user.IsActive, false));
```

ExecuteUpdateAsync无需先读取全部实体；成批删除则可以使用ExecuteDeleteAsync。

这两种操作会立即执行，不经过SaveChanges，当前DbContext中已跟踪的实体也不会自动跟着更新。多个调用要作为一个整体提交时，需要显式事务。

并发令牌不会自动参与这类更新。若业务需要版本检查，应自行添加筛选条件，并核对影响行数。[EF Core批量更新与删除](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete)

大量插入属于另一种操作，可以评估数据库的专用导入功能。ExecuteUpdate并不能承担所有批处理需求。

## 同一业务操作集中保存

已经加载并跟踪的实体，可以先完成修改，再统一提交：

```csharp
foreach (var user in usersToUpdate)
{
    user.IsActive = false;
}

await db.SaveChangesAsync();
```

这样避免每改一个对象就调用一次SaveChanges。一次保存仍可能执行多条SQL；提供程序支持事务时，默认会将本次保存中的修改作为一个整体提交或回滚。[EF Core事务](https://learn.microsoft.com/en-us/ef/core/saving/transactions)

大批量任务也不能无限积累实体。需要根据事务边界、内存占用和数据量，选择合适的批次。

## 索引围绕实际查询设计

模型中可以声明索引，再通过迁移应用到数据库：

```csharp
modelBuilder.Entity<User>()
    .HasIndex(user => user.Email)
    .IsUnique();
```

这里的唯一索引同时约束邮箱不得重复，是一条业务规则。

用于加速查询的索引，则要根据过滤、排序和关联条件设计，再用执行计划确认效果。索引会占用空间并增加写入成本，不宜给每个Where字段都单独建一个。
