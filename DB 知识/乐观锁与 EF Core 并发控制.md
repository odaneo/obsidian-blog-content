---
Description: 用两个人同时修改商品价格的例子，解释乐观锁如何通过版本号发现冲突，再演示EF Core的配置、保存和网页编辑处理。
Slug: optimistic-concurrency-with-ef-core
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[SubTags/EFCore|EFCore]]"
Published: false
Recommend: false
MeechoPolished: true
---

两个人同时编辑一件商品，后提交的价格可能覆盖先前的修改。乐观锁给每次保存加一道版本检查：数据还是原来的版本，才允许更新；版本已经变化，就提示冲突。

## 修改为什么会被覆盖

商品原价100元，小王和小李都打开了编辑页面。

| 顺序 | 小王 | 小李 |
| --- | --- | --- |
| 1 | 看到100元 | 看到100元 |
| 2 | 调整为120元并保存 | 继续编辑 |
| 3 | | 调整为90元并保存 |

如果更新条件只有商品ID，小李提交后，价格就成了90元。他可能完全不知道，小王已经改过这件商品。

## 保存时比较版本

为商品增加Version字段。两人打开页面时，读到的版本都为1。

小王保存时，更新语句同时检查ID和旧版本：

```sql
UPDATE Products
SET Price = 120, Version = 2
WHERE Id = 1 AND Version = 1;
```

这条语句要求1号商品的Version仍为1。满足条件，才写入120元，并将版本升为2。

轮到小李提交时，他带来的还是版本1，数据库中的值却已变成2。这次更新影响0行，应用便可以提示他查看最新价格，再决定如何修改。

乐观锁允许用户先读取、再编辑，最后才检查冲突，因此不必在整个编辑期间锁住记录。实际执行更新时，数据库仍会使用自己的锁机制。

## EF Core配置

以整数版本号为例，Product包含Id、Price和Version。Version使用int，新商品的初始值为1。

在DbContext的OnModelCreating里，将Version设为并发令牌：

```csharp
modelBuilder.Entity<Product>()
    .Property(p => p.Version)
    .IsConcurrencyToken();
```

并发令牌就是EF Core保存时用来核对的属性。接下来，在同一个DbContext中读取商品、修改价格并递增版本：

```csharp
var product = await db.Products
    .SingleAsync(p => p.Id == productId);

product.Price = newPrice;
product.Version++;

try
{
    await db.SaveChangesAsync();
}
catch (DbUpdateConcurrencyException)
{
    Console.WriteLine("保存失败，商品可能已被修改或删除。");
}
```

EF Core保留了查询时的原始值。代码中的Version++改变的是待保存的新值，更新条件使用的依然是旧值。

若记录已被修改或删除，保存就会抛出DbUpdateConcurrencyException。应用应让用户刷新数据，根据最新内容处理冲突。[EF Core并发控制](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)

这个例子由应用维护版本。凡是会修改商品的代码，都需要更新Version，版本检查才能发挥作用。

## 网页需要提交原始版本

打开编辑页和提交表单通常属于两次请求。即使保存请求刚查到了最新商品，也不能据此判断用户看到的内容是否过时。

表单需要带回打开页面时的Version。后端查询商品后，把这个值设为EF Core的原始版本：

```csharp
db.Entry(product).Property(p => p.Version).OriginalValue = request.Version;
```

这里，product是本次保存请求查出的实体，request.Version来自编辑页。设置完成后，再修改价格、递增版本并保存。

这样就能发现用户编辑期间发生的变化，避免用旧页面里的内容覆盖新数据。

## 数据库维护的版本

整数加1只是其中一种做法。数据库也可以提供自动变化的版本值。

| 数据库 | 常用版本值 |
| --- | --- |
| SQL Server | rowversion，由数据库生成和更新 |
| PostgreSQL | xmin，可借助Npgsql设为并发令牌 |

它们的配置方式和C#类型各有要求。采用数据库维护的版本后，无需再手动执行Version++。[SQL Server并发令牌](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)、[Npgsql并发令牌](https://www.npgsql.org/efcore/modeling/concurrency.html)
