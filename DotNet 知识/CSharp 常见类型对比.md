
## 常见类型的区别

| 特性       | class           | abstract class    | interface          | struct              |
| -------- | --------------- | ----------------- | ------------------ | ------------------- |
| 类型性质     | 引用类型            | 引用类型              | 接口类型，可由引用类型或值类型实现  | 值类型                 |
| 能否直接创建实例 | 非抽象且构造函数可访问时可以  | 不能                | 不能                 | 可以                  |
| 继承规则     | 最多继承一个类，可实现多个接口 | 同样最多继承一个类，可实现多个接口 | 可以继承多个接口           | 不能继承其他类或结构体，可实现多个接口 |
| 能否被继承    | 未声明`sealed`时可以  | 可以                | 可以被其他接口继承          | 不能                  |
| 方法实现     | 可以              | 可以，同时允许声明抽象成员     | 可以声明契约，也支持默认实现     | 可以                  |
| 字段与属性    | 可以有实例字段、静态字段和属性 | 同class            | 不能有实例字段，可以有属性及静态成员 | 可以有字段和属性            |
| 构造函数     | 可以有             | 可以有，供派生类构造过程使用    | 没有实例构造函数           | 可以有，现代C#也支持显式无参构造函数 |
| 常见用途     | 有状态的对象和业务服务     | 共享部分实现的基类         | 描述可替换的能力或契约        | 坐标、数值等具有值语义的数据      |

接口并非“不能继承”，而是不能作为类的基类提供实例状态。接口之间可以继承，类和结构体则通过实现接口提供对应能力。接口属性本身也不表示接口保存了一个实例字段。[Microsoft：接口](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface)

抽象类不要求自己一定包含抽象方法，但不能直接实例化。派生类如果仍有未实现的抽象成员，就也要保持抽象。[Microsoft：abstract](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/abstract)

struct的核心是值语义。赋值时复制结构体的值，不能据此简单断言“struct一定在栈上”。它也可能是对象或数组中的一部分。C# 10起可以显式声明无参构造函数，但`default(T)`仍然得到字段清零的默认值，不调用这类构造函数。[Microsoft：结构体](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/structs)

## record补充了什么

`record`为数据模型提供按值判断相等、便于阅读的`ToString()`以及`with`复制等能力。

| 对比项 | 普通class | record class | record struct |
| --- | --- | --- | --- |
| 类型性质 | 引用类型 | 引用类型 | 值类型 |
| 默认相等语义 | 引用相等，可以自行重写 | 编译器生成值相等逻辑 | 编译器生成值相等逻辑 |
| with表达式 | 普通class不支持 | 支持 | 支持 |
| 位置参数生成的属性 | 不适用 | 通常为`init`属性 | 通常为可读写属性 |
| 自动解构 | 需要自行提供`Deconstruct` | 位置记录会生成 | 位置记录会生成 |

只写`record`，等价于`record class`。下面是可放进.NET 8控制台项目运行的例子：

```csharp
using System;

var first = new UserProfile("小林", 25);
var second = new UserProfile("小林", 25);
var updated = first with { Age = 26 };

Console.WriteLine(first == second); // True
Console.WriteLine(first.Age);       // 25
Console.WriteLine(updated.Age);     // 26

public record UserProfile(string Name, int Age);
```

两个对象不是同一个实例，但因为类型和成员值相等，`==`返回`true`。

record也不一定不可变。可以显式声明带`set`的属性；即使属性只能初始化，它引用的列表等对象仍可能被修改。`with`默认也是浅复制，不会递归复制所有成员对象。[Microsoft：record类型](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/records)

普通业务对象可以先用class；需要共享实现时考虑抽象类；需要表达能力和替换关系时考虑接口；小型值对象可以考虑struct；希望按数据内容判断相等时，再考虑record。
