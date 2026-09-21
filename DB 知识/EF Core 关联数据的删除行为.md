---
Description: 用部门和员工的例子，快速理解 Cascade、SetNull、Restrict 的删除结果，以及 SetNull 与 ClientSetNull 的区别。
Slug: ef-core-relationship-delete-behaviors
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[EFCore]]"
Published: false
Recommend: false
MeechoPolished: true
---

删除父表的一条记录时，关联的子表记录怎么办？EF Core 用 DeleteBehavior 配置这个规则。

沿用部门和员工的例子：

- 父表：Departments，部门。
- 子表：Employees，员工。
- 员工的 DepartmentId 引用部门的 Id。

## 先记住三种常见行为

假设技术部有小王和小李，现在要删除技术部：

| 配置       | 删除结果                                   |
| -------- | -------------------------------------- |
| Cascade  | 技术部、小王和小李一起删除                          |
| SetNull  | 删除技术部，保留两名员工，把他们的 DepartmentId 设为 null |
| Restrict | 在外键非空、仍有员工关联的情况下，阻止删除技术部               |

SetNull 要求 DepartmentId 允许为空，也就是 C# 中的 `int?`。

表中的 Restrict 示例使用非空外键 `int`。如果外键可空，EF Core 可能先把已跟踪员工的外键置空，再删除部门，所以不能只看 Restrict 这个名字判断结果。[EF Core 删除行为说明](https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete)

## 代码怎么写

例如，员工必须有部门，并且有员工时禁止删除部门：

```csharp
// Employee 中的外键
public int DepartmentId { get; set; }
```

在 OnModelCreating 中配置：

```csharp
modelBuilder.Entity<Employee>()
    .HasOne(e => e.Department)
    .WithMany(d => d.Employees)
    .HasForeignKey(e => e.DepartmentId)
    .OnDelete(DeleteBehavior.Restrict);
```

想一起删除，就改成 Cascade；想保留员工并解除关联，就改成 SetNull，同时把 DepartmentId 改成可空类型。

修改模型后，还需要通过迁移更新数据库外键规则。

## SetNull和ClientSetNull差在哪

假设技术部有小王和小李，员工表的DepartmentId允许为空。

区别在于：删除技术部时，是数据库负责清空员工的DepartmentId，还是EF Core先修改员工记录。

### 只查询部门，没有查询员工

假设当前DbContext中没有查询过员工记录：

```csharp
var department = await db.Departments
    .SingleAsync(d => d.Id == 1);

db.Departments.Remove(department);
await db.SaveChangesAsync();
```

这段代码只查了部门。如果数据库外键规则已按配置更新：

- SetNull：数据库删除部门时，会把小王和小李的DepartmentId设为null，员工记录保留。
- ClientSetNull：EF Core不会为了删除部门，自动去查询它的员工。数据库里两名员工仍然引用这个部门，因此会阻止删除并报错。

### 查询部门时，也把员工查出来

将查询改成下面这样，使用默认的跟踪查询：

```csharp
var department = await db.Departments
    .Include(d => d.Employees)
    .SingleAsync(d => d.Id == 1);
```

这次，部门和员工记录都进入了当前DbContext。

再执行Remove和SaveChangesAsync时，ClientSetNull就能让EF Core先把这些员工的DepartmentId更新为null，再删除部门。

所以，SetNull 在数据库里配置了自动置空规则；ClientSetNull依靠EF Core处理当前DbContext正在跟踪的员工记录。[EF Core删除行为说明](https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete)