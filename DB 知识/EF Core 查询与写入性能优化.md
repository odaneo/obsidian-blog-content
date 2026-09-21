---
Description: 从 SQL、返回数据量和数据库往返入手，介绍 EF Core 的投影、无跟踪查询、分页、批量更新与索引优化，分清哪些优化需要结合实际负载验证。
Slug: ef-core-query-and-write-performance
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[EFCore]]"
Published: false
Recommend: false
MeechoPolished: true
---

EF Core 接口变慢时，先别急着换 ORM。把一次请求执行的 SQL 找出来，通常更容易发现原因：多查了数据、重复访问数据库，或者查询没有合适的索引。

本文示例使用关系型数据库提供程序；ExecuteUpdateAsync 和 ExecuteDeleteAsync 适用于 EF Core 7 及以上版本，包括 EF Core 8。

## 先看 SQL 和实际耗时

可以用 ToQueryString 查看查询形状：

```csharp
var query = db.Users.Where(user => user.IsActive);
Console.WriteLine(query.ToQueryString());
```

再结合 EF Core 日志和数据库执行计划，检查实际执行次数、耗时和扫描数据量。ToQueryString 便于理解翻译结果，但不能替代运行时观测。

## 查询端减少返回的数据

列表只展示编号和姓名，就不要读取头像二进制、大段介绍等字段。

```csharp
var users = await db.Users
    .Where(user => user.IsActive)
    .OrderBy(user => user.Id)
    .Select(user => new { user.Id, user.Name })
    .Take(50)
    .ToListAsync();
```

筛选和限制数量放在数据库查询中完成。提前 ToList 再分页，通常已经把不需要的数据带回来了。

深分页时，可以在适合“下一页”交互的场景中使用游标方式，例如按唯一 Id 筛选 `Id > lastId`，再排序取下一批。它与任意跳页的需求不同，需要按页面交互选择。[EF Core 高效查询](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying)

## 只读实体查询可以使用 AsNoTracking

```csharp
var users = await db.Users
    .AsNoTracking()
    .Where(user => user.IsActive)
    .Take(50)
    .ToListAsync();
```

默认跟踪查询会让 DbContext 记录实体状态，便于后续保存修改。只读页面不需要这种能力时，无跟踪查询可以减少相应开销。

如果投影只返回字符串、数字等值，没有包含实体，本来就不会跟踪实体。反过来，需要修改并调用 SaveChanges 的对象，保留跟踪往往更方便。无跟踪也不是所有查询都必然更快，要看结果规模和实体重复情况。[跟踪与无跟踪查询](https://learn.microsoft.com/en-us/ef/core/querying/tracking)

## 关联数据，避免循环里反复查询

先查订单，再为每张订单查明细，很容易形成 N+1。只需要数量或金额时使用 Select 投影，需要完整关联实体时再考虑 Include。

加载多个集合，还要评估联表产生的重复数据。具体例子见 [[EF Core N+1 查询问题]]，不必把所有关联都堆进一条 SQL。

## 写入端使用合适的批量操作

如果要将符合条件的用户统一停用，可以让数据库直接更新：

```csharp
var cutoff = DateTime.UtcNow.AddYears(-2);

var affected = await db.Users
    .Where(user => user.LastLoginAt < cutoff && user.IsActive)
    .ExecuteUpdateAsync(setters =>
        setters.SetProperty(user => user.IsActive, false));
```

这类操作不需要先加载全部实体。删除符合条件的数据，则有 ExecuteDeleteAsync。

它们执行后立即生效，不等待 SaveChanges，也不会同步修改当前 DbContext 中已经跟踪的对象。多个调用需要一起成功或失败时，要显式使用事务；并发令牌也不会自动套用，需要自行增加条件并检查影响行数。[批量更新与删除](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete)

批量插入又是另一类需求。大量导入可以评估数据库专用导入能力，不能把 ExecuteUpdate 当成统一解决所有批处理的接口。

## 按业务单元提交SaveChanges

不要每改一个对象就提交一次：

```csharp
foreach (var user in usersToUpdate)
{
    user.IsActive = false;
}

await db.SaveChangesAsync();
```

这里假设 usersToUpdate 是已跟踪的实体。一次 SaveChanges 可以提交这一组修改，但并不代表一定只有一条 SQL。在支持事务的提供程序中，默认会让这次保存中的修改一起成功或失败。[EF Core 事务说明](https://learn.microsoft.com/en-us/ef/core/saving/transactions)

也不要把无限多实体积累到同一个 DbContext。大批量工作需要在事务要求、内存占用和批次大小之间取舍。

## 索引要匹配真正的查询

可以在模型中声明索引，再通过迁移落实到数据库：

```csharp
modelBuilder.Entity<User>()
    .HasIndex(user => user.Email)
    .IsUnique();
```

唯一索引首先表达“邮箱不能重复”的约束。普通查询索引则要结合过滤、排序和关联方式设计，并看执行计划是否受益。

索引也会增加写入和存储成本，不是每个 Where 字段都应该单独建一个。
