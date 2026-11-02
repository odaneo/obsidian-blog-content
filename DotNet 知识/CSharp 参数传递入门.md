
C#默认按值传递参数。值类型复制它的值，引用类型复制指向对象的引用。引用类型并不因此自动变成按引用传递。

## 默认传递方式

| 对比项 | 值类型 | 引用类型 |
| --- | --- | --- |
| C#常见例子 | `int`、`bool`、`double`、`struct`、`record struct` | `class`、数组、`List<T>`、`string`、`record class` |
| 传给方法的内容 | 值的副本 | 对象引用的副本 |
| 给形参重新赋值 | 不会替换调用方变量 | 不会替换调用方变量 |
| 修改成员 | 修改副本自己的值成员，通常不影响原变量 | 如果对象允许修改，会修改共同引用的对象 |

方法拿到引用副本后，仍能找到同一个对象，因此可以修改对象内容。但把形参改成另一个引用，只是改变了方法内部那份副本。[Microsoft：方法参数](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/passing-value-type-parameters)

## 修改对象与替换变量

下面的代码可以放进.NET 8控制台项目运行：

```csharp
using System;

var person = new Person { Name = "小林" };

Change(person);
Console.WriteLine(person.Name); // 小周

Replace(ref person);
Console.WriteLine(person.Name); // 小陈

static void Change(Person value)
{
    value.Name = "小周"; // 修改共同引用的对象
    value = new Person { Name = "小王" }; // 只替换形参
}

static void Replace(ref Person value)
{
    value = new Person { Name = "小陈" }; // 替换调用方变量
}

public sealed class Person
{
    public string Name { get; set; } = "";
}
```

第一次调用里，名字被改成“小周”；后面给`value`重新赋值，没有替换外面的`person`。

第二次调用显式使用`ref`，方法才可以改变调用方变量保存的引用。

## 两个容易忽略的例外

struct被复制时，如果里面有引用类型字段，复制的是那个字段的引用。两份结构体仍可能指向同一个列表，修改列表内容会影响双方。值类型复制不是递归复制整个对象关系。

string虽然是引用类型，但字符串内容不可变。`text = text + "!"`会让变量保存新的字符串结果，不能据此修改其他变量原先引用的字符串。`char[]`则是可变数组，修改其中的元素会影响共享该数组的调用方。

