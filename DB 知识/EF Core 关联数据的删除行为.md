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

删除部门时，部门里的员工是一起删除、解除关联，还是阻止操作？EF Core通过DeleteBehavior配置这种父子记录的处理方式。

例子中，Departments保存部门，Employees保存员工。员工的DepartmentId引用所属部门的Id。

## 三种常见规则

技术部有小王和小李。删除这个部门，不同配置会产生不同结果。

| 配置 | 结果 |
| --- | --- |
| Cascade | 部门及两名员工一并删除 |
| SetNull | 员工保留，DepartmentId变为null |
| Restrict | 外键非空且仍有员工引用时，禁止删除部门 |

SetNull需要可空外键，C#属性应使用int?。

上表的Restrict使用非空外键int。如果外键允许为空，EF Core可能先解除已跟踪员工的关联，再删除部门。判断结果时，要同时看外键是否可空、员工是否被跟踪，以及数据库的外键规则。[EF Core级联删除](https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete)

## 配置删除行为

假设每名员工都必须归属一个部门，并要求有员工时不得删除部门。外键定义为：

```csharp
// Employee 中的外键
public int DepartmentId { get; set; }
```

在OnModelCreating中配置关联：

```csharp
modelBuilder.Entity<Employee>()
    .HasOne(e => e.Department)
    .WithMany(d => d.Employees)
    .HasForeignKey(e => e.DepartmentId)
    .OnDelete(DeleteBehavior.Restrict);
```

若业务要求随部门删除员工，使用Cascade。若要保留员工、只解除归属，使用SetNull，并把DepartmentId改为可空类型。

模型配置修改后，还要执行迁移，让数据库采用相应的外键规则。

## SetNull与ClientSetNull

两种配置都可以解除可空关联，关键在于谁负责修改员工记录。

SetNull让数据库外键承担置空工作。ClientSetNull则由EF Core处理当前DbContext中已跟踪的员工，不会自动把所有员工查出来。

### 只加载部门

假设当前DbContext尚未加载任何员工：

```csharp
var department = await db.Departments
    .SingleAsync(d => d.Id == 1);

db.Departments.Remove(department);
await db.SaveChangesAsync();
```

数据库外键已按配置更新时：

| 配置 | 保存结果 |
| --- | --- |
| SetNull | 数据库将两名员工的DepartmentId置空，再删除部门 |
| ClientSetNull | 员工仍引用部门，数据库拒绝删除 |

ClientSetNull失败的原因是EF Core没有跟踪这两名员工，而数据库也没有配置自动置空。

### 同时加载员工

把查询改为Include，并使用默认的跟踪查询：

```csharp
var department = await db.Departments
    .Include(d => d.Employees)
    .SingleAsync(d => d.Id == 1);
```

此时，员工也进入了当前DbContext。随后调用Remove和SaveChangesAsync，ClientSetNull便能先将已跟踪员工的DepartmentId改为null，再提交部门删除。

因此，SetNull依靠数据库规则处理关联，ClientSetNull依靠EF Core已掌握的实体。是否加载员工，会影响后者能否完成删除。[EF Core删除行为](https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete)
