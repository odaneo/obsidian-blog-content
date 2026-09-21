---
Description: 用查询用户名的例子解释SQL注入，再用EF Core演示参数化查询，简单说明输入拼接为什么危险以及如何防护。
Slug: sql-injection-prevention
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[SubTags/Web攻击|Web攻击]]"
Published: false
Recommend: false
MeechoPolished: true
---

SQL注入，就是用户输入的内容被当成了SQL命令，改变了程序原本要执行的查询。

## 注入怎么发生

假设页面按用户名查人，程序这样拼接SQL：

```csharp
var name = request.Username;

// 有风险的写法
var sql = "SELECT * FROM Users WHERE Username = '" + name + "'";
```

输入小王，查询就是：

```sql
SELECT * FROM Users WHERE Username = '小王';
```

但如果有人输入：

```text
' OR 1=1 -- 
```

拼出来的查询就成了：

```sql
SELECT * FROM Users WHERE Username = '' OR 1=1 -- ';
```

这段输入做了三件事：

- 单引号把前面的字符串提前结束了。
- `OR 1=1`表示“或者1等于1”，这个条件永远成立。
- `--`把后面的内容变成注释，不再执行。

原本只想查一个用户名，现在却可能查出所有用户。问题出在程序把用户输入直接拼进了SQL。

## 用参数化查询防护

参数化查询会把SQL语句和用户输入分开处理。用户填写的内容只作为一个值，不会变成查询命令。

使用EF Core时，可以这样写：

```csharp
var name = request.Username;

var users = await db.Users
    .Where(u => u.Username == name)
    .ToListAsync();
```

这里的`name`会被作为查询参数传入数据库。

即使输入的是那段攻击内容，数据库也只会查找用户名恰好等于这整段文字的人，不会执行里面的`OR 1=1`。[参数化查询说明](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

## 几个容易误会的地方

- 使用EF Core不代表所有写法都安全。自己拼接SQL后交给`FromSqlRaw`执行，仍然可能发生注入；手写SQL也需要正确传入参数。[EF Core说明](https://learn.microsoft.com/en-us/ef/core/querying/sql-queries)
- 过滤单引号、禁止某些关键词，不能替代参数化查询。
- 排序列名等不能作为普通值参数传入。可以只提供“按姓名”“按时间”等固定选项，由程序选择对应的排序代码。[白名单说明](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
