
如果一个方法需要“处理完以后通知调用方”，可以接收一个委托。调用方把要执行的方法交进去，接收方在合适的时候调用它。

委托是一种类型安全的方法引用。它可以保存目标方法，也可以作为参数传递。回调是一种使用方式，不表示这个方法一定异步执行。

## 先看一个日志回调

下面的委托约定：接收一个string参数，不返回结果。

```csharp
using System;

LogHandler logger = LogToConsole;
logger += LogToFile;
logger += LogToEmail;

WriteLog("系统启动", logger);

static void WriteLog(string message, LogHandler handler)
{
    handler(message);
}

static void LogToConsole(string message)
{
    Console.WriteLine($"控制台：{message}");
}

static void LogToFile(string message)
{
    Console.WriteLine($"模拟写入文件：{message}");
}

static void LogToEmail(string message)
{
    Console.WriteLine($"模拟发送邮件：{message}");
}

public delegate void LogHandler(string message);
```

`logger`组合了三个方法。调用一次委托，会按调用列表依次调用它们。示例中的文件和邮件处理仅打印文字，实际项目需要自行实现对应操作。

如果其中一个方法抛出异常，并且没有在调用流程中处理，后续方法不会继续执行。多播委托也不会自动并行调用这些方法。[Microsoft：使用委托](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/delegates/using-delegates)

## 三种常用的通用委托

很多时候，不必自己声明`LogHandler`。标准库已经提供了常见的委托类型。

| 类型 | 参数与返回值 | 示例 |
| --- | --- | --- |
| `Action`、`Action<T>`等 | 可以接收参数，返回`void` | `Action<string>`用于接收一条日志 |
| `Func<TResult>`、`Func<T, TResult>`等 | 最后一个类型参数表示返回值 | `Func<string, int>`用于把字符串转换成整数 |
| `Predicate<T>` | 接收一个参数，返回`bool` | `Predicate<int>`用于判断数字是否符合条件 |

```csharp
using System;

Action<string> log = message => Console.WriteLine(message);
Func<string, int> getLength = text => text.Length;
Predicate<int> isPositive = value => value > 0;

log("开始处理");
Console.WriteLine(getLength("hello")); // 5
Console.WriteLine(isPositive(10));     // True
```

`Func<string, int>`可以读成“输入string，输出int”。参数更多时，仍然是最后一项表示返回类型。

`Predicate<T>`与`Func<T, bool>`都能表达单参数判断，但它们是不同的委托类型。选择哪一种，要看接收方API的参数声明。

## 方法签名要兼容

绑定方法时，要符合委托要求的参数和返回值规则。最常见的情况是参数类型与返回类型相同；引用类型还存在协变、逆变等兼容规则，所以不能把它概括成所有类型都必须逐字一致。
