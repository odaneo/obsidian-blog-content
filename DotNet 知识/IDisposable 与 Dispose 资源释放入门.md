---
Description: 用简短的文件日志示例，说明谁调用 Dispose、using 在何时调用，以及开发者、DI 容器和 GC 分别负责什么。
Slug: csharp-idisposable-dispose-beginners-guide
TagRefs:
  - "[[后端]]"
SubTags:
  - "[[CSharp|CSharp]]"
Published: true
Recommend: false
MeechoPolished: true
---

`IDisposable`是一个清理资源的接口，`Dispose()`是它约定的方法。理解它时，先分清两件事：谁负责调用，方法内部负责清理什么。

## 一、谁调用Dispose

| 使用方式                     | 谁调用                | 调用时机                  |
| ------------------------ | ------------------ | --------------------- |
| 手写`logger.Dispose()`     | 开发者写的代码            | 执行到这一行时               |
| `using (...) { }`        | 编译器为`using`生成的清理代码 | 离开这个代码块时              |
| `using var logger = ...` | 编译器为`using`生成的清理代码 | 当前作用域结束时              |
| DI容器创建并管理的服务             | DI容器               | 所属作用域或容器释放时           |
| 只创建普通局部对象                | 没有安排调用方            | 离开方法不会因此执行`Dispose()` |

下面说的“`using`自动调用”，就是指编译器替`using`生成了清理代码，底层可以理解为`try/finally`。[Microsoft：using语句](https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/statements/using)

GC负责回收不再可达的托管对象内存，不会因为对象实现了`IDisposable`就调用它的`Dispose()`。例如，文件流对象的内存由GC管理，关闭文件的操作则由文件流的清理实现完成。[Microsoft：资源清理](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/unmanaged)

## 二、using的调用时机

带大括号的`using`，在离开代码块时调用清理方法：

```csharp
using (var writer = new StreamWriter("demo.txt"))
{
    writer.WriteLine("你好！");
} // using在这里自动调用writer.Dispose()。
```

这段代码会创建或覆盖`demo.txt`。`using`调用`writer.Dispose()`后，`StreamWriter`会提交缓冲内容，并关闭它拥有的底层流。

`using var`则等到当前作用域结束：

```csharp
static void WriteFile()
{
    using var writer = new StreamWriter("demo.txt");
    writer.WriteLine("你好！");
    Console.WriteLine("仍在方法内");
} // using在方法退出时自动调用writer.Dispose()。
```

这里不是`WriteLine()`执行完就释放。`using`安排的清理发生在方法退出时，包括正常返回和异常离开的情况；进程被强制终止等情况不在这个保证内。

## 三、完整示例

下面的日志类自己创建writer，因此也负责释放writer。示例适用于.NET 8及以上的控制台项目，运行时会创建或覆盖`application-demo.log`。

```csharp
using System;
using System.IO;

using (var logger = new FileLogger("application-demo.log"))
{
    logger.Write("程序启动");
    Console.WriteLine("日志写入完成");
} // using在这里自动调用logger.Dispose()。

Console.WriteLine("using代码块已结束");

public sealed class FileLogger : IDisposable
{
    private readonly StreamWriter _writer;
    private bool _disposed;

    public FileLogger(string path)
    {
        _writer = new StreamWriter(path);
    }

    public void Write(string message)
    {
        if (_disposed)
        {
            throw new ObjectDisposedException(nameof(FileLogger));
        }

        _writer.WriteLine(message);
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _writer.Dispose(); // FileLogger.Dispose调用内部writer的Dispose。
        Console.WriteLine("FileLogger.Dispose已调用writer.Dispose");
    }
}
```

输出顺序是：

```text
日志写入完成
FileLogger.Dispose已调用writer.Dispose
using代码块已结束
```

这次清理有三步，每一步都有明确的调用方：

1. `using`自动调用`logger.Dispose()`。
2. `FileLogger.Dispose()`调用内部的`_writer.Dispose()`。
3. `StreamWriter.Dispose()`提交缓冲内容，并关闭它拥有的底层流。

`using`只安排第一步，不会检查`FileLogger`里有哪些字段。第二步需要开发者在类中实现。[Microsoft：实现Dispose方法](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose)

`_disposed`记录是否已经开始释放，避免重复调用再次执行清理。`Write()`也检查这个标记，阻止调用方继续写入已经关闭的writer。这个简单示例按单线程使用设计。

## 四、谁负责安排释放

通常由资源拥有者安排清理：

- 自己创建并拥有的临时资源：开发者用`using`安排调用，或在`finally`里手写`Dispose()`。
- 参数传入的借用资源：借用方通常不调用`Dispose()`，由拥有者负责。某些API会接管资源，需按具体约定判断。
- DI容器创建并管理的服务：由DI容器调用`Dispose()`，使用服务的业务代码通常不提前释放它。

内置DI容器不会负责释放直接注册的已有实例，例如`services.AddSingleton(existingInstance)`；该实例仍由拥有者安排清理。[Microsoft：DI中的释放责任](https://learn.microsoft.com/zh-cn/dotnet/core/extensions/dependency-injection/guidelines)

相关说明见[[ASP.NET 依赖注入中的生命周期与资源释放]]。

## 五、异步释放由谁调用

`IAsyncDisposable`约定的是`DisposeAsync()`，由`await using`调用并等待完成：

```csharp
await using (var writer = new StreamWriter("async-demo.txt"))
{
    await writer.WriteLineAsync("异步日志");
} // await using在这里调用并等待writer.DisposeAsync()。
```

这段代码会创建或覆盖`async-demo.txt`。其中，`WriteLineAsync()`负责写入，`DisposeAsync()`负责清理，两者不能互相代替。[Microsoft：异步释放](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-disposeasync)

## 六、几个容易混淆的点

- `using`、开发者或DI容器调用`Dispose()`后，对象引用可能仍然存在。资源已经结束使用，不代表GC已经回收对象内存。
- 给变量赋值为null，不会代替调用`Dispose()`。
- 终结器由运行时安排执行，时机无法确定；它不是GC替你调用`Dispose()`。
- `using`内的异步操作应在资源有效范围内完成。如果直接返回尚未完成的Task，`using`可能先调用`Dispose()`，任务却还在使用资源。
