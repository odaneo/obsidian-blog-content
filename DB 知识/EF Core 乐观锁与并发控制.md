---
Id: 71b900d0a9b74cc2b11035f0123dd230
Description: 用两次商品改价说明EF Core怎样用版本号发现冲突，再用库存补货解释PostgreSQL的Read Committed和原子累加。
Slug: optimistic-concurrency-with-ef-core
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[SubTags/EFCore|EFCore]]"
Published: true
Recommend: false
MeechoPolished: true
---

一件商品标价100元，小王和小李同时打开编辑页。小王先改成120元，随后小李提交了90元。

如果后端只按商品ID保存，最终价格就是90元。两次提交都成功了，但小李并不知道小王刚改过价格，便覆盖了他的修改。这种情况叫丢失更新。

## 用版本号发现冲突

假设商品还有一个版本号，初始值为1。小王保存120元时，版本一起升到2。

小李提交的仍是页面上的版本1。更新条件里带上这个版本，SQL就变成了这样：

```sql
UPDATE products
SET price = 90,
    version = version + 1
WHERE id = 1 AND version = 1;
```

数据库里已经是版本2，这条SQL更新不到记录。乐观锁通过这次比较发现了冲突，应用便可以提示小李刷新价格，再决定是否继续修改。

## EF Core中的保存逻辑

编辑页和保存接口分属两次HTTP请求。小李的表单传回`Price = 90`和`Version = 1`，而保存接口重新查询时，可能已经读到版本2。

这里用来判断冲突的是表单带回的版本1，它反映了小李开始编辑时看到的状态。

`Version`在`OnModelCreating`中配置为并发令牌后，EF Core会将它的原始值用于`UPDATE`的条件：

```csharp
modelBuilder.Entity<Product>()
    .Property(p => p.Version)
    .IsConcurrencyToken();
```

保存方法如下。`db`是注入的DbContext，`request`包含新价格和页面上的旧版本。

```csharp
[HttpPut("{id:int}/price")]
public async Task<IActionResult> UpdatePrice(
    int id,
    UpdatePriceRequest request,
    CancellationToken token)
{
    var product = await db.Products
        .AsTracking()
        .SingleOrDefaultAsync(p => p.Id == id, token);

    if (product is null)
    {
        return NotFound();
    }

    // WHERE 用页面传回的旧版本
    db.Entry(product)
        .Property(p => p.Version)
        .OriginalValue = request.Version;

    product.Price = request.Price;
    product.Version++;

    try
    {
        await db.SaveChangesAsync(token);
        return NoContent();
    }
    catch (DbUpdateConcurrencyException)
    {
        return Conflict("商品已被修改或删除，请刷新后再试。");
    }
}
```

保存时，`OriginalValue`进入版本比较条件，`Version++`产生待写入的新版本。如果记录不再匹配更新条件，EF Core会抛出`DbUpdateConcurrencyException`，这里将它转成409响应。[EF Core并发控制](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)

示例中的整数版本从1开始，由应用递增，冲突检查依赖各个修改入口同步更新版本。PostgreSQL的`xmin`和SQL Server的`rowversion`则由数据库维护。Npgsql可以把`xmin`映射成`uint`类型的并发令牌。[Npgsql并发令牌](https://www.npgsql.org/efcore/modeling/concurrency.html)、[SQL Server版本值](https://learn.microsoft.com/en-us/ef/core/saving/concurrency#native-database-generated-concurrency-tokens)

## Read Committed和库存累加

`Read Committed`是PostgreSQL默认的事务隔离级别，普通`SELECT`读取语句开始时的快照。小王提交后，新的查询能看到120元；小李的页面却还是先前读到的100元。保存接口里的版本比较，可以识别这期间发生的修改。[PostgreSQL事务隔离](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)

补货的情况有些不同。改价提交的是目标价格，补货提交的则是增量，例如再加10件。下面的SQL直接在当前库存上累加：

```sql
UPDATE inventory
SET available = available + 10
WHERE warehouse_id = $1 AND sku = $2;
```

库存原有100件，两笔补货各加10件。第一笔尚未提交时，第二笔更新同一行会等待。第一笔提交后，PostgreSQL用更新后的行重新检查第二笔的条件。仓库和SKU仍然匹配，第二笔便从110继续加到120。[PostgreSQL并发更新示例](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)

两笔改价同时更新一行时，也会遇到行锁等待。小王提交后，版本已经变成2，小李的SQL却仍在匹配版本1，因此更新不到记录。补货SQL中的仓库和SKU没有变化，两次累加就都能生效。
