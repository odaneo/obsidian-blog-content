---
Description: 用部门和员工的例子，简单解释 EF Core N+1 查询问题，以及怎样通过 Include 加载明细、通过 Select 统计人数，减少重复查询。
Slug: ef-core-n-plus-one-queries
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[EFCore]]"
Published: false
Recommend: false
MeechoPolished: true
---

N+1 问题就是：先查一次列表，再为列表中的每条记录各查一次关联数据，导致数据库被反复访问。

## 一个例子就能看明白

假设数据库里有两张表：

Departments 部门表：

|Id|Name|
|---|---|
|1|技术部|
|2|财务部|

Employees 员工表：

|Id|Name|DepartmentId|
|---|---|---|
|101|小王|1|
|102|小李|1|
|103|小张|2|

员工通过 `DepartmentId` 表示自己属于哪个部门。

现在需要展示部门和员工：

```csharp
// 先查部门：1 次
var departments = await db.Departments.ToListAsync();

foreach (var department in departments)
{
    // 每个部门再查一次员工：N 次
    var employees = await db.Employees
        .Where(e => e.DepartmentId == department.Id)
        .ToListAsync();
}
```

如果有 10 个部门，就是 1 + 10 = 11 次查询；有 100 个部门，就是 101 次。

每次查询都要等待数据库返回。次数一多，接口就容易变慢。[EF Core 对 N+1 的说明](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying)

## 需要员工明细就一起加载

用 Include 提前加载部门对应的员工：

```csharp
var departments = await db.Departments
    .Include(d => d.Employees)
    .ToListAsync();

foreach (var department in departments)
{
    // 员工已经加载，直接使用
    foreach (var employee in department.Employees)
    {
        Console.WriteLine(employee.Name);
    }
}
```

在默认单查询模式下，这个简单例子通常通过一条联表 SQL 取回数据，避免每个部门再查一次。

如果配置了拆分查询，Include 也可能执行多条 SQL，但不等于每个部门都单独查询一次。[单查询与拆分查询](https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries)

## 只需要人数就直接统计

页面只展示部门名和人数时，不必把所有员工都读出来：

```csharp
var rows = await db.Departments
    .Select(d => new
    {
        d.Name,
        EmployeeCount = d.Employees.Count()
    })
    .ToListAsync();
```

这里的统计放在查询表达式中，由 EF Core 翻译后交给数据库执行。

排查 N+1 时，可以先看循环里有没有数据库查询。若启用了延迟加载，访问尚未加载的导航属性也可能触发查询，需要一起检查。