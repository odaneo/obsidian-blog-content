
这篇笔记按面试中常见的提问方式，整理C#的参数传递、异步并发、资源释放和集合选择。

每个问题先说明核心区别，再补充容易误解的边界。独立代码示例采用.NET 8写法；需要上下文或额外依赖的片段会单独注明。

## 1. 什么是扩展方法

扩展方法让已有类型获得一种类似实例方法的调用方式，不需要修改原类型，也不需要继承它。

下面使用传统的`this`参数写法。方法放在非嵌套、非泛型的静态类里，方法本身也是静态的，第一个参数表示被扩展的类型。

```csharp
using System;

Console.WriteLine("123".ToIntOrDefault());   // 123
Console.WriteLine("abc".ToIntOrDefault(10)); // 10

public static class StringExtensions
{
    public static int ToIntOrDefault(
        this string text, int defaultValue = 0)
    {
        return int.TryParse(text, out int value)
            ? value
            : defaultValue;
    }
}
```

编译器把调用对应到静态方法，并没有真的改变string类型。如果有适用的实例方法，会优先考虑实例方法；单纯“名字一样”并不足以概括所有重载解析情况。

C# 14还增加了扩展块语法，传统写法仍然可以使用。[Microsoft：扩展成员](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/extension-methods)

## 2. 什么情况下使用扩展方法

常见用途是补充系统类型或第三方类型的小工具方法，或者给`IEnumerable<T>`这类接口提供通用操作。

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

var values = new List<int>();
Console.WriteLine(values.IsEmpty()); // True

public static class EnumerableExtensions
{
    public static bool IsEmpty<T>(this IEnumerable<T> source)
    {
        return !source.Any();
    }
}
```

LINQ中很多熟悉的方法就是扩展方法。它们适合表达围绕某个类型的通用操作，但不会获得访问该类型私有成员的额外权限。

如果方法主要在编排复杂业务，放在明确的业务服务里，通常比不断给类型附加扩展方法更容易查找。

## 3. C#有没有内存泄漏

有。GC能够回收不再可达的托管对象，但不知道某个仍被引用的对象在业务上是否已经没用了。

例如，静态集合不断保存对象，又没有清理策略，这些对象就可能长期占用内存：

```csharp
using System.Collections.Generic;

Cache.Items.Add(new object());

public static class Cache
{
    public static readonly List<object> Items = new();
}
```

事件也是常见原因。生命周期较长的发布者保存了订阅者的事件处理委托，可能间接让订阅者一直可达。不再需要订阅时，应根据对象的生命周期安排取消订阅。

此外，文件句柄等资源如果没有及时释放，也会造成资源占用。部分类型有终结器或SafeHandle提供兜底，但执行时机不能代替明确的释放安排。

这里需要分清“托管对象一直可达”与“资源没有及时归还”，二者可能同时发生。[Microsoft：GC基础](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)

## 4. GC怎样回收内存

GC从根引用出发，寻找仍能访问的托管对象，再回收符合条件的不可达对象所占用的托管堆内存。

常说的分代是0代、1代和2代。大对象通常进入大对象堆LOH，LOH一般随2代收集一起处理，它不是独立的“第3代”。

`using`解决的是按时调用资源清理方法：

```csharp
using System;
using System.IO;

using (var stream = new MemoryStream())
{
    stream.WriteByte(1);
    Console.WriteLine(stream.Length); // 1
}
```

离开代码块时，`using`调用`Dispose()`。对象的托管内存何时被回收，仍由GC决定。GC也不会仅因为一个对象实现了`IDisposable`，就自动调用它的`Dispose()`。

一般不需要主动调用`GC.Collect()`。更详细的过程可看[[CSharp GC 工作原理]]，释放责任可看[[IDisposable 与 Dispose 资源释放入门]]。

## 5. class作为参数时传递什么

C#默认按值传递。class参数拿到的是对象引用的副本，因此可以通过这个副本修改同一个对象。

重新给形参赋值，只会改变方法内部的引用副本。要替换调用方变量保存的引用，需要显式使用`ref`等机制。

```csharp
using System;

var person = new Person { Name = "Alice" };

Change(person);
Console.WriteLine(person.Name); // Tom

Replace(ref person);
Console.WriteLine(person.Name); // Jerry

static void Change(Person value)
{
    value.Name = "Tom";
    value = new Person { Name = "另一个对象" };
}

static void Replace(ref Person value)
{
    value = new Person { Name = "Jerry" };
}

public sealed class Person
{
    public string Name { get; set; } = "";
}
```

面试时可以直接说：默认传递引用的副本，修改对象与替换调用方变量是两件事。[Microsoft：方法参数](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/passing-value-type-parameters)

## 6. 按值传递会不会修改原对象

会，取决于副本里面保存了什么。

class参数的引用副本仍然指向原对象。struct参数复制的是结构体的值，但结构体里的引用字段仍可能指向共享对象。

```csharp
using System;

var point = new Point { X = 1 };
ChangePoint(point);
Console.WriteLine(point.X); // 1

var box = new Box { Value = 1 };
var holder = new Holder { Box = box };
ChangeHolder(holder);
Console.WriteLine(box.Value); // 100

static void ChangePoint(Point value)
{
    value.X = 10;
}

static void ChangeHolder(Holder value)
{
    value.Box.Value = 100;
}

public struct Point
{
    public int X;
}

public sealed class Box
{
    public int Value;
}

public struct Holder
{
    public Box Box;
}
```

`point`的整数值被复制了，所以外面的X没变。`holder`也被复制了，但两份结构体中的Box字段仍引用同一个对象。

需要隔离修改时，要明确设计复制策略，不能只凭“这是struct”就认为内部所有数据都独立。

## 7. ref、out与in有什么区别

三者都与引用参数有关，但读写约定不同。

| 修饰符   | 方法内的规则           | 调用处写法      | 常见用途        |
| ----- | ---------------- | ---------- | ----------- |
| `ref` | 可以读取和重新赋值        | 显式写`ref`   | 方法可能修改调用方变量 |
| `out` | 读取前先赋值，正常返回前必须赋值 | 显式写`out`   | 输出解析结果等数据   |
| `in`  | 可以读取，不能修改参数      | 通常可以省略`in` | 按只读引用接收数据   |

```csharp
using System;

int number = 1;
Increase(ref number);
Console.WriteLine(number); // 2

SetValue(out int result);
Console.WriteLine(result); // 10

Show(in number); // 输出 2

static void Increase(ref int value) => value++;

static void SetValue(out int value) => value = 10;

static void Show(in int value) => Console.WriteLine(value);
```

`in`不保证整个对象不可变。如果传入的是class引用，不能给这个参数换一个引用，但仍可能修改该对象允许修改的属性。

对于较大的结构体，`in`有时能减少复制；但临时变量和防御性复制等因素也可能影响效果，需要结合实际调用判断。

## 8. C#有哪些并发相关工具

可以按要解决的问题来分组：

| 问题 | 常见工具 |
| --- | --- |
| 直接控制线程或向线程池提交工作 | `Thread`、`ThreadPool` |
| 表示与组合任务 | `Task`、`Task<T>`、`Task.WhenAll` |
| 编写异步等待流程 | `async/await` |
| 批量并行计算 | `Parallel.For`、`Parallel.ForEach`、PLINQ |
| 有上限的异步批量处理 | `Parallel.ForEachAsync` |
| 同步与互斥 | `lock`、`Monitor`、`Mutex`、`ReaderWriterLockSlim` |
| 原子操作与并发数量控制 | `Interlocked`、`SemaphoreSlim` |
| 发出并响应取消通知 | `CancellationTokenSource`、`CancellationToken` |
| 共享集合与生产消费 | `ConcurrentDictionary`、`ConcurrentQueue`、`BlockingCollection`、`Channel` |
| 定时执行 | `System.Threading.Timer`、`System.Timers.Timer` |
| 回到界面线程 | WinForms的`Control.Invoke`、WPF的`Dispatcher`、MAUI的`MainThread` |


这些工具不都在“创建线程”。异步I/O可以在没有专用等待线程的情况下推进；锁和信号量则负责协调访问。选择方式与完整示例可看[[CSharp 多线程并发入门]]。

## 9. Task与async/await有什么区别

Task是表示操作状态的对象。它可以记录成功、失败或取消，也可以保存返回值。

`async/await`是编写异步控制流程的语言机制。`await`在等待尚未完成的操作时，让方法交还控制权，而不是同步占住线程等结果。

下面是一个独立的HTTP示例，运行时需要联网：

```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;

using var client = new HttpClient();
string text = await GetDataAsync(client);
Console.WriteLine(text.Length);

static async Task<string> GetDataAsync(HttpClient client)
{
    return await client.GetStringAsync("https://example.com");
}
```

`GetStringAsync`返回`Task<string>`，`await`取得完成后的字符串。给方法加上`async`不会自动创建线程，方法里长时间的同步计算也不会因此消失。

异步方法常返回`Task`、`Task<T>`或相应的ValueTask类型。除事件处理等明确场景外，应避免使用难以等待和组合的`async void`。[Microsoft：任务异步编程模型](https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/task-asynchronous-programming-model)

## 10. Task与Thread有什么区别

Thread直接表示执行代码的线程。Task表示一项工作或异步操作，可以组合、等待并观察异常。

`Task.Run`通常把工作交给线程池；异步I/O返回的Task则不代表有一条线程一直在后台等待它。

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

var thread = new Thread(() => Console.WriteLine("专用线程"));
thread.Start();
thread.Join();

await Task.Run(() => Console.WriteLine("线程池工作"));
```

常规业务代码通常先使用Task和现成的异步API。需要专用线程、特定线程属性等控制时，再考虑直接创建Thread。长时间的异步等待，本身不是创建专用线程的理由。

## 11. 委托与事件有什么区别

委托定义了可以引用哪类方法。委托实例可以保存方法，也可以组合、传递和调用。

事件是基于委托类型声明的成员。对下面这种常见事件声明，外部只能订阅和取消订阅，不能给它重新赋值，也不能直接触发。

```csharp
using System;

var publisher = new Publisher();
MessageHandler handler = message => Console.WriteLine(message);

publisher.Changed += handler;
publisher.Raise();
publisher.Changed -= handler;

public delegate void MessageHandler(string message);

public sealed class Publisher
{
    public event MessageHandler? Changed;

    public void Raise()
    {
        Changed?.Invoke("状态已更新");
    }
}
```

发布者决定什么时候发出通知，订阅者提供收到通知以后执行的逻辑。需要让派生类参与触发时，通常提供受保护的触发方法，而不是让派生类直接调用基类声明的事件。[Microsoft：event](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/event)

通用委托的比较可看[[CSharp 委托与回调入门]]。

## 12. 数据库连接怎样归还连接池

以启用连接池的SqlClient为例，创建连接对象与建立物理连接是两件事。`Open`可能复用池中的连接；`Close`或`Dispose`通常把可复用的物理连接归还池中。

归还并不保证保留物理连接。连接已经失效，或者连接池的清理规则需要移除它时，底层仍可能关闭连接。

下面是使用Microsoft.Data.SqlClient的方法片段，项目需要引用对应包：

```csharp
public static async Task OpenAndUseAsync(
    string connectionString, CancellationToken token)
{
    using var connection = new SqlConnection(connectionString); // SqlConnection需要实现IDisposable
    await connection.OpenAsync(token);

    // 在此范围内执行数据库操作。
}
```

片段还需要引入`Microsoft.Data.SqlClient`、`System.Threading`和`System.Threading.Tasks`命名空间。

连接归还依赖明确的Close或Dispose安排。GC负责连接对象的托管内存，不应把GC或终结处理当作及时归还连接的机制。忘记释放连接，可能让后续调用因为池中没有可用连接而等待甚至超时。[Microsoft：SQL Server连接池](https://learn.microsoft.com/en-us/dotnet/framework/data/adonet/sql-server-connection-pooling)

## 13. using有哪些用法

同一个关键字，在引入名称与清理资源时承担不同职责。

| 用法 | 示例 | 作用 |
| --- | --- | --- |
| 引入命名空间 | `using System;` | 简化类型名称 |
| 引入静态成员 | `using static System.Math;` | 可以直接调用`Sqrt(9)` |
| 声明别名 | `using IntList = System.Collections.Generic.List<int>;` | 用别名表示类型 |
| using语句 | `using (var resource = Create()) { ... }` | 离开代码块时释放 |
| using声明 | `using var resource = Create();` | 离开当前作用域时释放 |
| await using | `await using var resource = CreateAsyncResource();` | 按异步释放协议调用并等待清理 |

using声明从C# 8开始支持。它的释放点是当前作用域结束，不一定要等整个方法结束。

`await using`使用异步清理协议，不表示创建资源的表达式本身一定需要异步执行。

## 14. using依靠什么机制释放资源

常见的同步资源实现`IDisposable`，异步资源实现`IAsyncDisposable`。此外，符合语言规定释放模式的`ref struct`等情况也受支持，因此“using只识别这两个接口”并不完整。

对于普通引用类型的同步资源，可以把机制理解为：

```csharp
using System.IO;

var stream = new MemoryStream();
try
{
    stream.WriteByte(1);
}
finally
{
    stream.Dispose();
}
```

这里对应在成功取得资源后，用`try/finally`安排释放的情形。`using`还会根据类型等情况处理必要的空值检查。[Microsoft：using语句](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/using)

Dispose执行类型自己实现的清理逻辑，可能关闭句柄、清理拥有的成员资源、归还连接，或者做其他收尾。它不是“马上释放对象托管内存”的指令。

`GC.SuppressFinalize(this)`常出现在带终结清理设计的Dispose模式中，但不能据此断言每个Dispose都一定调用它，或者每种资源都需要终结器。[Microsoft：实现Dispose](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose)

实际项目还要先看谁拥有资源。DI容器提供并管理的服务，通常由对应作用域或宿主安排释放，参见[[ASP.NET 依赖注入中的生命周期与资源释放]]。

## 15. using范围内可以启动并发任务吗

可以，但要分别满足两个条件：对象支持相应的并发访问，且所有使用都在释放前结束。

下面的短程序需要联网，展示等待多次HTTP操作完成后再释放对象：

```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;

using (var client = new HttpClient())
{
    Task<string>[] tasks =
    {
        client.GetStringAsync("https://example.com/?item=1"),
        client.GetStringAsync("https://example.com/?item=2")
    };

    string[] results = await Task.WhenAll(tasks);
    Console.WriteLine(results.Length); // 2
}
```

HttpClient在真实服务中通常通过长期复用实例或`IHttpClientFactory`管理；这里的短生命周期只是为了说明释放边界。

如果启动工作后没有等待，程序就可能先离开using，后台工作却仍在使用已经释放的对象。用`Task.Run`包住调用，也不会延长对象的生命周期。

反过来，等到最后再Dispose，只能解决生存期问题，不会让DbContext、普通流或其他不支持并发访问的对象自动变得线程安全。需要按类型规则选择独立实例、同步访问或其他协调方式。

## 16. List与Dictionary哪个更快

先明确操作，再比较性能。

| 操作 | List<T> | Dictionary<TKey, TValue> |
| --- | --- | --- |
| 根据位置访问 | 索引访问通常为O(1) | 不提供按第几个元素访问的语义 |
| 根据业务键查找 | 通常需要扫描，O(n) | 哈希查找平均接近O(1) |
| 追加或插入数据 | 尾部追加均摊O(1)，中间插入通常需移动元素 | 新增键值对平均接近O(1)，扩容等操作有额外成本 |
| 完整遍历 | O(n) | 通常O(n)，常数成本受内部状态影响 |
| 存储开销 | 主要是元素数组及预留容量 | 还需要桶、条目和相关管理信息 |

List适合按位置处理的数据；Dictionary适合按键定位数据。两者不是仅凭集合名字就能排出统一的快慢顺序。[Microsoft：List](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1?view=net-8.0)、[Microsoft：Dictionary](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2?view=net-8.0)

下面分别演示按位置访问与按键查找：

```csharp
using System;
using System.Collections.Generic;

var names = new List<string> { "Alice", "Tom" };
for (int i = 0; i < names.Count; i++)
{
    Console.WriteLine(names[i]);
}

var users = new Dictionary<int, string>
{
    [10] = "Alice",
    [20] = "Tom"
};

if (users.TryGetValue(20, out string? name))
{
    Console.WriteLine(name);
}

foreach (var pair in users)
{
    Console.WriteLine($"{pair.Key}: {pair.Value}");
}
```

Dictionary可以使用int作为键，但这仍是键查找，不表示访问“第几个元素”。不要为了写for循环而反复调用`ElementAt(i)`，把一次遍历变成重复枚举。

List底层的元素槽位连续存放。如果T是引用类型，槽位里连续保存的是引用，不表示所有对象内容也连续。

仅做完整遍历时，List通常具有较简单的存储结构；循环内部需要频繁按键找对象时，Dictionary可能更合适。实际耗时还受数据量、键的哈希成本和运行时版本影响，应按真实操作测量。

## 17. 数据采集量很大时如何减少GC卡顿

可以先按三个方向排查：每秒创建了多少临时对象，哪些对象一直被保留，以及采集速度是否超过了处理速度。确认问题后，再选择对应的优化方式。

例如，每秒采集1万条记录，如果每条记录又额外产生约10KB的临时数组和字符串，仅这一处就有约100MB的分配量每秒。即使最终保存的数据不多，中间处理也可能带来明显的GC压力。

### 先确认卡顿是否由GC引起

工具安装好后，可以用下面的命令观察采集进程，把1234换成实际进程ID：

```shell
dotnet-counters monitor --process-id 1234 --counters System.Runtime
```

重点看分配速率、GC耗时、各代回收次数、托管堆大小和LOH大小，并结合业务代码记录的队列长度与处理耗时一起判断。

| 观察到的现象 | 重点检查什么 |
| --- | --- |
| 分配速率很高，GC发生频繁 | 每条数据是否创建了很多临时对象或重复副本 |
| Gen 2回收频繁，LOH分配较多 | 是否反复创建较大的数组、字符串或批量结果 |
| 回收后存活对象仍持续增加 | 队列、缓存、集合或订阅关系是否一直保留数据 |
| 队列长度不断增长 | 消费速度是否跟不上采集速度 |
| 卡顿时GC暂停不明显 | 继续检查锁等待、同步I/O、CPU计算和UI刷新 |

dotnet-counters适合先看趋势。需要确认某次卡顿是否与GC暂停重合，可以进一步用dotnet-trace或PerfView记录事件，并通过分配分析定位创建对象最多的代码位置。[Microsoft：dotnet-counters](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-counters)、[Microsoft：运行时计数器](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/available-counters)、[Microsoft：dotnet-trace](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-trace)

### 减少每条数据产生的临时对象

先检查执行最频繁的采集和解析代码：

- 一块数据是否经历了多次`ToArray()`、字符串转换和重新编码。
- 是否为每条数据都创建新的数组、列表、任务或日志文本。
- 能否按批处理、批量写入，并为已知大小的集合预设合理容量。
- 是否存在值类型转成object带来的装箱。
- 同一段原始数据能否直接解析，减少中间副本。

同步解析时，可以用`Span<T>`表示原缓冲区中的一段数据；异步API常使用`Memory<T>`。它们可以帮助减少复制，但不会自动管理底层缓冲区的生存期。[Microsoft：Memory与Span使用规则](https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/memory-t-usage-guidelines)

对于频繁使用的较大缓冲区，可以评估复用。默认情况下，总大小达到约85,000字节的对象会进入大对象堆LOH，其回收与Gen 2相关。反复分配并丢弃大数组，可能增加回收开销和延迟波动。[Microsoft：大对象堆](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap)

### 用ArrayPool复用读取缓冲区

`ArrayPool<T>`提供“借数组、使用、归还”的方式，让后面的操作有机会继续使用同一块内存。

下面用内存流模拟输入。示例只统计读取的字节数，重点是整个读取循环复用一个缓冲区，而不是每读取一块数据就new一个数组。

```csharp
using System;
using System.Buffers;
using System.IO;

using var input = new MemoryStream(new byte[] { 1, 2, 3, 4 });

const int bufferSize = 16 * 1024;
ArrayPool<byte> pool = ArrayPool<byte>.Shared;
byte[] buffer = pool.Rent(bufferSize);

try
{
    long totalBytes = 0;
    int bytesRead;

    while ((bytesRead = await input.ReadAsync(
        buffer.AsMemory(0, bufferSize))) > 0)
    {
        // 本次有效数据只有buffer的前bytesRead个字节。
        // 实际项目可以在这里处理这段数据。
        totalBytes += bytesRead;
    }

    Console.WriteLine(totalBytes); // 4
}
finally
{
    pool.Return(buffer);
}
```

使用时要明确几条规则：

- 租到的数组长度可能大于申请长度，也可能保留旧内容。只处理本次实际写入或读取的有效范围。
- 在所有使用都结束后，通过finally等清理流程归还；同一份租借不要重复归还。
- 如果把数组交给另一个异步消费者，必须等它处理完，才能归还。不能一边让消费者读取，一边把数组还给池。
- 数组池可能保留内存供下次使用，也可能在需要时分配新数组。复用并不等于进程内存会立刻下降，仍需控制同时使用的缓冲区数量。

上面的代码只借用了一次数组。如果采集流程已经一直复用同一个固定数组，也不必为了使用池而改写。池化主要适合缓冲区频繁申请和释放的路径。[Microsoft：ArrayPool](https://learn.microsoft.com/en-us/dotnet/api/system.buffers.arraypool-1?view=netstandard-2.1)、[Microsoft：Rent](https://learn.microsoft.com/en-us/dotnet/api/system.buffers.arraypool-1.rent?view=net-10.0)

### 界面更新与数据采集分开安排

如果是带界面的采集程序，可以让采集和解析在后台进行，再按固定频率批量刷新表格、曲线和统计信息。

例如，采集数据需要完整保存，但曲线显示可以按时间窗口汇总。这样能减少每条记录都创建展示对象、格式化字符串和触发绑定更新的开销。展示采样不能替代完整数据的存储。

把计算交给Task.Run，可以减少UI线程直接执行的工作，但同一进程里的GC仍可能暂停UI线程。增加后台任务数量，不能隔离这类GC停顿。[Microsoft：后台GC](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/background-gc)

### 最后再评估GC配置

在分配和积压已经得到控制后，再根据实际负载评估GC模式。

Workstation GC面向客户端应用，Server GC面向高吞吐服务。选择要结合响应时间、CPU和内存测量，不能简单认为开启Server GC就一定更流畅。[Microsoft：Workstation与Server GC](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/workstation-server-gc)

对确实有低延迟要求的阶段，可以进一步评估`LowLatency`或`SustainedLowLatency`等模式。它们会改变部分回收行为，可能让更多内存暂时保留；内存压力较大时仍可能发生回收，不能保证完全没有暂停。[Microsoft：GC延迟模式](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/latency)

一般不要在采集循环里频繁调用`GC.Collect()`。这可能主动增加回收和暂停，也无法清除仍被队列或缓存引用的数据。[Microsoft：主动触发GC](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/induced)

### 优化后怎样验证

在相同采集速率、记录大小和测试时长下，比较优化前后的分配速率、GC暂停、Gen 2回收次数、队列峰值和处理吞吐量。

同时检查数据是否完整、是否发生重复或丢失，以及长时间运行后队列和内存是否趋于稳定。缓冲区复用与限流的收益，需要通过这些结果确认。


## 18. 一个系统有两个独立运行的模块，需要发送任务、查询状态，并持续获取处理进度。你会选择gRPC还是REST API？如何设计通信方式，减少两个模块之间的依赖？

我会根据通信需求选择。如果两个模块都由我们维护，需要频繁通信、持续推送进度，我倾向选gRPC；如果主要是查询和配置，还需要方便浏览器或第三方接入，我倾向选REST API。

减少模块之间的依赖，主要从以下几个方面设计：

1. 只通过约定好的接口通信。模块A只需要知道B提供哪些功能、需要什么参数、返回什么结果，不需要了解B内部的类和处理过程。
2. 把跨模块流程集中管理。如果一个流程需要先执行A，再执行B，可以交给协调模块安排，避免A、B相互调用，形成复杂依赖。
3. 耗时任务先返回任务ID。接收任务后先返回“已接受”和任务ID，再通过查询或通知获取进度与结果。“已接受”与“已完成”要明确区分。
4. 考虑超时、断线和重复请求。超时后先查询任务是否已经执行；同一任务重复提交时，能够识别并避免重复执行。断线恢复后，也能重新获取任务状态。

例如，A完成任务后，只报告“任务123已完成，结果在某个位置”。协调模块根据流程决定下一步是否调用B。这样，即使A的内部实现发生变化，只要接口约定保持兼容，B通常就不需要跟着修改。

## 19. await与Task.Result有什么区别，await后会回到原线程吗

`Task<T>.Result`是同步获取结果的属性。如果任务尚未完成，读取它会阻塞当前线程，直到任务完成；任务已经成功完成时则直接返回结果。不能把它理解为“结果没准备好就返回空值”。

`await`在任务尚未完成时挂起当前异步方法、交还控制权，不会为了等待这项操作而阻塞线程；任务已经完成时，直接继续执行，不一定发生挂起或线程切换。

| 写法 | 任务尚未完成时 | 任务已经成功完成时 |
| --- | --- | --- |
| `await task` | 挂起方法，不阻塞线程等待 | 直接取得结果并继续 |
| `task.Result` | 阻塞当前线程等待 | 直接取得结果并继续 |

大量请求同时阻塞时，新工作可能排队，产生线程池饥饿，放大接口延迟。线程池能够增加线程，但不会因此消除阻塞的成本。[Microsoft：线程池饥饿诊断](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation)

ASP.NET Core通常由线程池线程处理请求，没有“每个请求独有的主线程”。默认也没有专用的SynchronizationContext，因此await后的代码不保证由原线程执行，可能换另一条线程池线程继续。[Microsoft：ConfigureAwait说明](https://devblogs.microsoft.com/dotnet/configureawait-faq/)

方法没有执行完的代码不会丢失。编译器生成的异步状态机保存恢复位置和跨越await后仍需要的数据；查询完成后，后续执行逻辑继续运行。数据库查询的Task完成，不代表整个接口方法已经执行完。[Microsoft：异步状态机](https://devblogs.microsoft.com/dotnet/asyncawait-faq/)

面试时可以这样回答：Result是同步取结果，任务未完成时会阻塞线程；await可以挂起方法并交还控制权。ASP.NET Core中不保证回到原线程，方法的执行进度由异步状态机保存。

线程数量、主线程与线程池的关系，以及不同“上下文”的作用，参见[[ASP.NET 线程池与异步方法恢复机制]]。


## 20. await和Task.WhenAll如何影响查询耗时

在foreach中，每次查询后立即await，查询仍然串行执行。3个SKU每次查询100ms，总耗时约300ms。

先发起3次查询，再用Task.WhenAll统一等待，资源足够时，等待可以重叠，总耗时约100ms。

如果查询100个SKU，每次独占一条连接100ms，而连接池最多提供20条连接，理想情况下需要5批，总耗时约500ms。这里假设没有其他请求，也忽略其他开销。

Task.WhenAll只负责等待全部任务完成，不会自动创建线程或限制并发，也不能突破连接池等资源的上限。
