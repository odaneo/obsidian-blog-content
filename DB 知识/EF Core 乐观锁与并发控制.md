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

一件商品卖100元。小王和小李各自打开编辑页，都看到了100元。

小王先把价格改成120元。小李的页面还显示100元，他填了90元再提交。如果后端只按商品ID更新，最终价格就会变成90元，小王的修改就被覆盖了。这种情况叫丢失更新。

## 保存时检查版本

给商品加一个版本号。两人打开页面时，价格是100元，版本是1。小王保存成功后，价格变成120元，版本升到2。

小李的页面仍然带着版本1。后端拿到他的90元和旧版本，可以这样更新。

```sql
UPDATE products
SET price = 90,
    version = version + 1
WHERE id = 1 AND version = 1;
```

数据库里已经是版本2，`WHERE`匹配不到那行，更新影响0行。应用可以提示小李刷新页面，再决定还要不要改成90元。

这就是乐观锁。编辑期间可以正常工作，提交时再检查数据有没有被改过。

## 用EF Core保存改价

打开编辑页和点击保存是两次HTTP请求。关键是把打开页面时的版本随表单提交。小李传回的是`Price = 90`和`Version = 1`。保存请求重新查询时可能已经读到版本2，EF Core仍然要用小李看到的版本1做比较。

在`OnModelCreating`里，把`Version`配置为并发令牌。EF Core会把这个属性的原始值加进`UPDATE`的`WHERE`条件。

```csharp
modelBuilder.Entity<Product>()
    .Property(p => p.Version)
    .IsConcurrencyToken();
```

下面是Controller里的保存方法。`db`是注入的DbContext，`request`带着用户填写的价格和打开页面时的版本。

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

`OriginalValue`是用来比较的旧版本。`Version++`是准备写入的新版本。数据库更新影响0行时，EF Core会抛出`DbUpdateConcurrencyException`，接口就可以返回409，让页面提示用户处理冲突。[EF Core并发控制](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)

这个例子用整数版本，新商品从1开始。应用负责推进版本，其他修改商品的入口也要遵守同一规则。也可以使用数据库提供的版本值，例如PostgreSQL的`xmin`或SQL Server的`rowversion`。Npgsql支持将`xmin`映射为`uint`并用作并发令牌。[Npgsql并发令牌](https://www.npgsql.org/efcore/modeling/concurrency.html)、[SQL Server版本值](https://learn.microsoft.com/en-us/ef/core/saving/concurrency#native-database-generated-concurrency-tokens)

## Read Committed和库存累加

`Read Committed`是PostgreSQL默认的事务隔离级别。普通`SELECT`按语句开始时的快照读数据。小王提交后，再查一次能看到120元。小李打开编辑页时那次查询早就结束了，页面还留着100元。这就是保存时要带上旧版本的原因。[PostgreSQL事务隔离](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)

改价请求提交的是目标值，比如「改成90元」。库存补货提交的是变化量，比如「再加10件」。两笔补货都需要生效时，可以让数据库对当前库存做加法。

```sql
UPDATE inventory
SET available = available + 10
WHERE warehouse_id = $1 AND sku = $2;
```

假设库存有100件，两笔补货各加10件。第一笔把库存改成110，第二笔如果这时更新同一行，会等第一笔提交。PostgreSQL随后用新行重新检查第二笔的`WHERE`。仓库和SKU仍然匹配，第二笔就用110再加10，最终库存是120。[PostgreSQL并发更新示例](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)

两次改价如果也恰好在数据库里撞上，同样会先等行锁，再检查`WHERE`。区别在条件上。库存累加仍能匹配仓库和SKU，小李的改价还需要匹配旧版本1，而小王已经把版本改成了2。
