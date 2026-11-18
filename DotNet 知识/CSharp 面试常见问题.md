

## 1. 什么是扩展方法

扩展方法可以让已有类型像调用实例方法一样调用静态方法，无需修改原类型，也不用继承。

传统写法要求使用非嵌套、非泛型的静态类。方法也必须是静态的，第一个参数用`this`指定要扩展的类型。

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

这种调用只是编译器提供的便利，并没有改变string类型。如果存在适用的实例方法，编译器会优先选择它。

C# 14新增了扩展块语法，传统写法仍然有效。[Microsoft：扩展成员](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/extension-methods)

## 2. 什么情况下使用扩展方法

适合为系统类型或第三方类型补充小工具方法，也可以为`IEnumerable<T>`等接口提供通用操作。

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

LINQ的许多方法就是扩展方法。它们可以补充调用方式，但不能因此访问类型的私有成员。

复杂的业务流程通常更适合放在业务服务中，方便查找和维护。

## 3. ref、out与in有什么区别

三者都按引用传参，区别在于方法能否读取、修改参数。

| 修饰符 | 方法内的规则 | 调用处写法 | 常见用途 |
| --- | --- | --- | --- |
| `ref` | 可以读取和修改 | 必须写`ref` | 修改调用方的变量 |
| `out` | 读取前先赋值，正常返回前必须赋值 | 必须写`out` | 返回解析结果等数据 |
| `in` | 可以读取，不能修改参数 | 通常可省略`in` | 按只读引用接收数据 |

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

`in`限制的是参数本身，不保证对象不可变。传入class引用时，方法不能替换这个引用，但仍可能修改对象的属性。

较大的结构体可以考虑使用`in`减少复制，但实际效果也受临时变量和防御性复制影响。

## 4. C#有哪些并发相关工具

按用途选择即可，不必把它们都理解为“开线程”。

| 用途 | 常见工具 |
| --- | --- |
| 控制线程或提交线程池工作 | `Thread`、`ThreadPool` |
| 表示和组合任务 | `Task`、`Task<T>`、`Task.WhenAll` |
| 异步等待 | `async/await` |
| 批量并行计算 | `Parallel.For`、`Parallel.ForEach`、PLINQ |
| 限制异步批量处理的并发数 | `Parallel.ForEachAsync` |
| 同步与互斥 | `lock`、`Monitor`、`Mutex`、`ReaderWriterLockSlim` |
| 原子操作和并发数量控制 | `Interlocked`、`SemaphoreSlim` |
| 取消通知 | `CancellationTokenSource`、`CancellationToken` |
| 并发集合与生产消费 | `ConcurrentDictionary`、`ConcurrentQueue`、`BlockingCollection`、`Channel` |
| 定时执行 | `System.Threading.Timer`、`System.Timers.Timer` |
| 回到界面线程 | WinForms的`Control.Invoke`、WPF的`Dispatcher`、MAUI的`MainThread` |

异步I/O通常不需要专门占用一条线程等待，锁和信号量则用来协调访问。具体选择和示例见[[CSharp 多线程并发入门]]。

## 5. Task与Thread有什么区别

`Thread`表示线程，`Task`表示一项工作或异步操作。Task方便等待、组合任务和处理异常。

`Task.Run`把工作提交给线程池，不保证新建线程。异步I/O返回的Task，也不代表后台始终有一条线程在等待。

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

var thread = new Thread(() => Console.WriteLine("专用线程"));
thread.Start();
thread.Join();

await Task.Run(() => Console.WriteLine("线程池工作"));
```

一般业务代码优先使用Task和现成的异步API。需要专用线程或特定线程属性时，再考虑Thread。

## 6. 委托与事件有什么区别

委托规定方法的签名，委托实例可以保存、传递和调用符合签名的方法。

事件基于委托类型声明。外部代码只能订阅和取消订阅，不能直接赋值或触发事件。

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

发布者决定何时通知，订阅者决定收到通知后做什么。派生类需要发出基类事件时，通常通过基类提供的受保护方法完成。[Microsoft：event](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/event)

更多委托用法见[[CSharp 委托与回调入门]]。

## 7. 数据库连接怎样归还连接池

以开启连接池的SqlClient为例：

- `Open`可能直接复用池中的物理连接。
- `Close`或`Dispose`通常将连接归还池中。
- 失效或需要清理的连接，底层仍会关闭。

下面的片段需要引用Microsoft.Data.SqlClient包，并引入`Microsoft.Data.SqlClient`、`System.Threading`和`System.Threading.Tasks`命名空间。

```csharp
public static async Task OpenAndUseAsync(
    string connectionString, CancellationToken token)
{
    using var connection = new SqlConnection(connectionString); // SqlConnection需要实现IDisposable
    await connection.OpenAsync(token);

    // 在此范围内执行数据库操作。
}
```

`using`会在离开作用域时调用`Dispose`。不要依赖GC及时归还连接，否则连接池可能被耗尽，后续请求只能等待或超时。[Microsoft：SQL Server连接池](https://learn.microsoft.com/en-us/dotnet/framework/data/adonet/sql-server-connection-pooling)

## 8. using有哪些用法

`using`主要用于简化名称和释放资源。

| 用法 | 示例 | 作用 |
| --- | --- | --- |
| 引入命名空间 | `using System;` | 简化类型名称 |
| 引入静态成员 | `using static System.Math;` | 可直接调用`Sqrt(9)` |
| 声明别名 | `using IntList = System.Collections.Generic.List<int>;` | 用别名表示类型 |
| using语句 | `using (var resource = Create()) { ... }` | 离开代码块时释放资源 |
| using声明 | `using var resource = Create();` | 当前作用域结束时释放资源 |
| await using | `await using var resource = CreateAsyncResource();` | 等待异步清理完成 |

using声明从C# 8开始支持。资源会在当前作用域结束时释放，不一定等到方法结束。

`await using`表示异步释放资源，不代表创建资源时也必须异步。

## 9. using范围内可以启动并发任务吗

可以，前提是对象支持并发访问，而且所有任务都在对象释放前完成。

下面的示例需要联网，先等待两次HTTP请求完成，再释放HttpClient：

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

只启动任务却不等待，可能导致对象先被释放，后台任务还在使用它。`Task.Run`也不会自动延长对象的生命周期。

等待任务完成只解决释放时机的问题，不会让DbContext等对象变得线程安全。

实际服务中的HttpClient通常长期复用，或由`IHttpClientFactory`管理。这里仅用来演示释放时机。

## 10. List与Dictionary哪个更快

取决于做什么操作。

| 操作 | List<T> | Dictionary<TKey, TValue> |
| --- | --- | --- |
| 按位置访问 | O(1) | 不支持按第几个元素访问 |
| 按业务键查找 | 通常需要遍历，O(n) | 平均O(1) |
| 添加数据 | 尾部追加均摊O(1)，中间插入通常要移动元素 | 平均O(1)，扩容有额外开销 |
| 完整遍历 | O(n) | 通常O(n) |
| 内存开销 | 主要是元素数组和预留容量 | 还需要桶和条目等信息 |

按位置访问或完整遍历，通常选List；经常按键查找，通常选Dictionary。

List的元素槽位连续存放。如果元素是引用类型，连续的是引用，对象本身不一定连续。实际性能还受数据量、哈希计算和运行时版本影响。

## 11. 数据采集量大时如何减少GC卡顿

先确认卡顿是否由GC引起，再检查临时对象、数据积压和大数组分配。

例如，每秒采集1万条记录，每条额外产生约10KB的临时数据，就会带来约100MB的每秒分配量。

### 确认问题来源

安装dotnet-counters后，把1234替换为采集进程的ID：

```shell
dotnet-counters monitor --process-id 1234 --counters System.Runtime
```

结合分配速率、GC耗时、各代回收次数、堆大小，以及业务队列长度判断。

| 现象 | 检查方向 |
| --- | --- |
| 分配多，GC频繁 | 临时对象和重复复制 |
| Gen 2回收频繁，LOH分配多 | 大数组、长字符串和大批量结果 |
| 回收后存活对象仍增加 | 队列、缓存、集合或事件订阅是否一直保留数据 |
| 队列持续增长 | 处理速度是否跟不上采集速度 |
| 卡顿时GC暂停不明显 | 锁等待、同步I/O、CPU计算或UI刷新 |

dotnet-counters用来观察趋势；需要分析具体暂停和分配位置时，再用dotnet-trace或PerfView。[Microsoft：dotnet-counters](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-counters)、[Microsoft：运行时计数器](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/available-counters)、[Microsoft：dotnet-trace](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-trace)

### 减少临时分配

- 减少重复的`ToArray()`、字符串转换和重新编码。
- 避免每条记录都创建数组、列表、任务或日志文本。
- 尽量批量处理，并为已知大小的集合预设容量。
- 检查值类型转成object时的装箱。
- 直接解析原始数据，减少中间副本。

同步解析可以考虑`Span<T>`，异步API常用`Memory<T>`。它们能帮助减少复制，但仍要保证底层缓冲区在使用期间有效。[Microsoft：Memory与Span使用规则](https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/memory-t-usage-guidelines)

默认情况下，总大小达到约85,000字节的对象会进入大对象堆LOH，回收与Gen 2相关。频繁分配大数组时，可以考虑复用缓冲区。[Microsoft：大对象堆](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap)

### 用ArrayPool复用缓冲区

`ArrayPool<T>`可以租借和归还数组。下面的读取循环始终复用同一个缓冲区：

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

使用时注意：

- 实际数组可能更大，也可能有旧数据，只处理有效范围。
- 等所有使用者完成后再归还，同一次租借只归还一次。
- 归还后的数组不能继续使用，也不能交给仍在运行的异步任务。
- 数组池可能保留内存，仍需限制同时使用的缓冲区数量。

如果原来已经复用固定数组，就不必为了池化而改写。数组池更适合频繁申请和释放缓冲区的场景。[Microsoft：ArrayPool](https://learn.microsoft.com/en-us/dotnet/api/system.buffers.arraypool-1?view=netstandard-2.1)、[Microsoft：Rent](https://learn.microsoft.com/en-us/dotnet/api/system.buffers.arraypool-1.rent?view=net-10.0)

## 12. 两个模块通信选gRPC还是REST API

如果两个模块都由团队维护，需要频繁通信和持续推送进度，可以优先考虑gRPC。以查询、配置为主，还要方便浏览器或第三方接入时，可以考虑REST API。

减少依赖可以从四点入手：

1. 约定接口。双方只关心功能、参数和结果，不依赖对方内部的类和实现。
2. 集中安排跨模块流程。需要先执行A再执行B时，由协调模块安排，减少A、B相互调用。
3. 耗时任务先返回任务ID。先告知“已接受”，再通过查询或通知获取进度，明确区分接受和完成。
4. 处理超时、断线和重复提交。超时后先查任务状态，重复请求要能识别，重连后可以继续获取进度。

例如，A只报告任务123已经完成及结果位置，由协调模块决定是否调用B。只要接口兼容，A内部调整时，B通常无需跟着修改。

## 13. await与Task.Result有什么区别

任务尚未完成时，`Task<T>.Result`会阻塞当前线程，直到结果就绪。`await`则挂起当前方法，交还控制权，不占着线程等待。

| 写法 | 任务未完成 | 任务已成功完成 |
| --- | --- | --- |
| `await task` | 挂起方法，不阻塞线程 | 直接取结果并继续 |
| `task.Result` | 阻塞线程等待 | 直接取结果并继续 |

大量请求同步等待，可能造成线程池饥饿，让后续工作排队。[Microsoft：线程池饥饿诊断](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation)

`await`之后是否回到原线程，取决于运行环境。ASP.NET Core通常在线程池上处理请求，没有每个请求专属的主线程，默认也没有专用的SynchronizationContext，因此恢复时可能换线程。[Microsoft：ConfigureAwait说明](https://devblogs.microsoft.com/dotnet/configureawait-faq/)

编译器生成的异步状态机会保存恢复位置和后续需要的数据，操作完成后继续执行。数据库查询完成，只表示查询的Task结束，接口方法可能还有后续代码。[Microsoft：异步状态机](https://devblogs.microsoft.com/dotnet/asyncawait-faq/)

更多说明见[[ASP.NET 线程池与异步方法恢复机制]]。

## 14. await和Task.WhenAll如何影响查询耗时

假设查询3个SKU，每次耗时100ms：

- 每次查询后立即`await`：串行执行，总耗时约300ms。
- 先发起3次查询，再`await Task.WhenAll`：资源充足时可以重叠等待，总耗时约100ms。

并发也受资源限制。如果查询100个SKU，每次独占一条连接100ms，而连接池最多提供20条连接，理想情况下需要5批，约500ms。这里忽略其他请求和额外开销。

`Task.WhenAll`只负责等待所有任务结束，不会自动创建线程或限制并发，也无法突破连接池等资源的上限。

## 15. `Span<T>`与`Memory<T>`有什么用

它们是一段连续内存的“视图”，可以只处理数组或缓冲区中的一部分，不必复制出新数组。常见好处是减少临时分配、数据复制和GC压力。[Microsoft：Span与Memory概览](https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/)

| 对比 | Span<T> | Memory<T> |
| --- | --- | --- |
| 常见用途 | 同步解析、切片和处理数据 | 异步读取、传递和保存缓冲区视图 |
| 跨await保存并继续使用 | 不可以 | 可以 |
| 存为普通class的字段 | 不可以 | 可以 |

### 数组切片能省掉新数组和复制

传统做法是把需要的部分复制出来；Span直接操作原数组中的那一段。

```csharp
using System;

int[] values = { 10, 20, 30, 40 };

// 复制切片：分配新数组，再复制两个元素
int[] copy = new int[2];
Array.Copy(values, 1, copy, 0, 2);
copy[0] = 99;
Console.WriteLine(values[1]); // 20，原数组未变

// Span切片：不创建新数组，也不复制元素
Span<int> part = values.AsSpan(1, 2);
part[0] = 99;
Console.WriteLine(values[1]); // 99，修改的是原数组
```

频繁切片或处理大数组时，省下的分配和复制更有意义。但如果需要一份互不影响的数据副本，仍然应该复制。

### 字符串解析能省掉临时字符串

例如，从`"12345,Tokyo"`中读取前面的数字：

```csharp
using System;

string text = "12345,Tokyo";
int separator = text.IndexOf(',');

// Substring：先创建字符串"12345"，再解析
int oldValue = int.Parse(text.Substring(0, separator));

// AsSpan：直接解析原字符串中的这一段
int newValue = int.Parse(text.AsSpan(0, separator));

Console.WriteLine(oldValue == newValue); // True
```

`text.AsSpan`得到的是`ReadOnlySpan<char>`。结果相同，但省掉了中间的子字符串，适合高频日志解析、CSV字段处理等场景。[Microsoft：Int32.Parse](https://learn.microsoft.com/en-us/dotnet/api/system.int32.parse?view=net-8.0)

如果之后又调用`ToString()`或`ToArray()`，就会重新产生字符串或数组，不能指望这些转换也不分配内存。

### Memory适合把缓冲区片段传给异步操作

下面两种写法都把相同数据读到buffer下标2开始的三个位置：

```csharp
using System;
using System.IO;

byte[] source = { 1, 2, 3 };
byte[] buffer = new byte[8];

// 传统重载：分别传数组、起点和长度
using var oldInput = new MemoryStream(source);
int oldCount = await oldInput.ReadAsync(buffer, 2, 3);

// Memory重载：把同一个区间作为一个值传递
using var newInput = new MemoryStream(source);
Memory<byte> target = buffer.AsMemory(2, 3);
int newCount = await newInput.ReadAsync(target);

// Memory可以跨await保留，之后再通过Span同步访问
Console.WriteLine(target.Span[0]); // 1
```

`AsMemory`本身不会复制数组。它的优势是把“缓冲区及其范围”放在一个值里，方便切片、传递和跨`await`保存；同步处理时再取`Span`。

传统的`byte[] + offset + count`也可以直接使用原数组，不需要复制。因此，这个例子中换成Memory不代表一定更快，主要是接口更方便。

### 什么时候值得用

- 高频同步解析、处理字节或字符片段，优先考虑`Span<T>`；只读时用`ReadOnlySpan<T>`。
- 异步文件或网络I/O需要传递缓冲区片段，考虑`Memory<T>`或`ReadOnlyMemory<T>`。
- 原来就按索引处理数组，或使用不复制的区间接口，改用它们未必有明显收益。少量数据处理优先保持代码清楚。
