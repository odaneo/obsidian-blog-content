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

先查询一份部门列表，再逐个部门查询员工，就会形成N+1：列表查询占1次，N个部门的员工查询再占N次。

## 查询次数怎样增加

数据库包含部门和员工两张表。

Departments部门表：

| Id | Name |
| --- | --- |
| 1 | 技术部 |
| 2 | 财务部 |

Employees员工表：

| Id | Name | DepartmentId |
| --- | --- | --- |
| 101 | 小王 | 1 |
| 102 | 小李 | 1 |
| 103 | 小张 | 2 |

DepartmentId记录员工的所属部门。若展示页面这样读取数据：

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

10个部门要执行11次查询，100个部门则是101次。每次访问都有数据库往返的等待，查询数量随列表长度增长，接口耗时也容易随之增加。[EF Core高效查询](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying)

## 员工明细一起加载

页面需要员工列表时，可以用Include提前取回关联数据：

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

循环只读取已加载的员工，无需再向数据库查询。

默认单查询模式下，这个简单关联通常由一条联表SQL完成。配置拆分查询后，Include可能执行多条SQL，但查询方式仍不同于为每个部门各发一次请求。[单查询和拆分查询](https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries)

## 人数交给数据库统计

页面若只显示部门名和员工数量，就没有必要加载员工明细：

```csharp
var rows = await db.Departments
    .Select(d => new
    {
        d.Name,
        EmployeeCount = d.Employees.Count()
    })
    .ToListAsync();
```

Count位于查询表达式中，EF Core会把统计翻译成SQL，数据库返回部门名和人数即可。

排查时，先检查循环内部的数据库调用。启用延迟加载后，读取未加载的导航属性也可能发起查询，日志中同样需要留意这类访问。
