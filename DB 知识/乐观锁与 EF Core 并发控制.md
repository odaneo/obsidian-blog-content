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

两个人修改同一件商品时，后保存的人可能覆盖前一个人的修改。乐观锁就是在保存前检查版本，发现数据已经变了，就让这次保存失败。

## 为什么会覆盖

假设商品价格是100元：

| 顺序 | 小王 | 小李 |
| --- | --- | --- |
| 1 | 读到价格100元 | 读到价格100元 |
| 2 | 改成120元，保存成功 | 还在编辑 |
| 3 | | 改成90元，点击保存 |

如果程序只按商品ID保存，最后价格就会变成90元。小王的修改被覆盖了，小李甚至不知道有人改过价格。

## 版本号怎么起作用

给商品加一个Version字段。假设两人读到的版本都是1。

保存时，同时检查商品ID和最初读到的版本。小王的更新可以理解为：

```sql
UPDATE Products
SET Price = 120, Version = 2
WHERE Id = 1 AND Version = 1;
```

意思是：只有1号商品仍然处于版本1，才把价格改成120元，并把版本改成2。

小王保存成功后，小李也带着版本1来保存。但数据库已经是版本2，条件对不上，所以这次更新没有修改任何记录。

这时，程序就可以提示小李：“商品刚被别人修改了，请查看最新价格后再保存。”

“乐观”指的是允许大家先读取和编辑，到保存时再检查是否冲突。它不会在用户编辑期间一直占着这条记录，但数据库执行更新时仍有自己的锁机制。

## EF Core怎么写

下面用整数版本号演示。假设Product有Id、Price和Version三个属性，Version是int类型，新增商品时设为1。

在DbContext的OnModelCreating中配置：

```csharp
modelBuilder.Entity<Product>()
    .Property(p => p.Version)
    .IsConcurrencyToken();
```

这句配置告诉EF Core：保存商品时，要用Version检查数据有没有被别人改过。EF Core把这种用于检查的属性叫作“并发令牌”。

接着，在同一个DbContext里查询、修改和保存：

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

EF Core会记住查询时的旧版本。即使代码把Version加了1，保存时的检查条件用的仍然是旧版本，新版本则作为要写入的值。

如果别人抢先改了版本，`SaveChangesAsync`就会抛出`DbUpdateConcurrencyException`。应用可以据此提示用户刷新，查看最新内容后再决定怎么修改。[EF Core并发控制](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)

这里的版本号需要代码维护。其他修改商品的地方，也要同步更新Version。

## 网页编辑要带回旧版本

用户打开页面和点击保存，通常是两次请求。页面可能打开了十分钟，期间商品早就被别人改过了。

因此，页面提交修改时，还需要把打开页面时的Version一起传回来。后端应把它设为EF Core用于比较的原始版本：

```csharp
db.Entry(product).Property(p => p.Version).OriginalValue = request.Version;
```

这里的product是保存请求中重新查询出的商品，request.Version是页面带回的旧版本。设置后再修改价格、递增版本并保存。

这样检查的是“用户看到的那一版有没有变化”，而不仅是“保存请求刚查到的数据有没有变化”。

## 版本号也可以自动维护

前面的例子由代码给整数加1。有些数据库也能自动提供版本值：

| 数据库 | 常用方式 |
| --- | --- |
| SQL Server | rowversion，由数据库更新 |
| PostgreSQL | xmin，可通过Npgsql配置为并发令牌 |

它们都能用来检查数据是否改变，但配置和C#类型不同。使用数据库自动维护的版本时，就不再手动执行`Version++`。[SQL Server说明](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)、[PostgreSQL说明](https://www.npgsql.org/efcore/modeling/concurrency.html)
