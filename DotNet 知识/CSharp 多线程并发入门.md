---
Id: "85af516dd9cc485dab73f9b9d750ec8f"
Description: 从异步与多线程的区别讲起，用代码说明 C# 如何执行并发任务、保护共享数据、限制并发量，以及处理取消、异常和后端服务中的并发问题。
Slug: csharp-multithreading-and-concurrency-guide
TagRefs:
  - "[[Tags/后端|后端]]"
SubTags:
  - "[[SubTags/CSharp|CSharp]]"
Published: true
Recommend: false
MeechoPolished: true
---

## 一、异步与多线程有什么区别

这几个词经常放在一起，但含义不同。

| 概念 | 关注什么 | 一个例子 |
| --- | --- | --- |
| 并发 | 多个任务的执行时间相互重叠 | 请求A等待网络时，请求B开始执行 |
| 并行 | 多个任务在同一时刻执行计算 | 多个CPU核心同时处理不同图片 |
| 多线程 | 使用多个线程执行代码 | 线程池调度多个计算任务 |
| 异步 | 操作尚未完成时，让调用方继续推进 | 等待数据库返回时，不一直占着线程 |

使用`async/await`等待尚未完成的异步操作时，当前方法会暂停执行，让线程有机会处理其他工作。

`Task`表示一项操作及其完成状态，不等于一条线程。一个网络请求可以有自己的Task，却不需要专门留一条线程陪着它等待。

理解异步时，需要分别观察三件事：方法现在在哪个线程执行，等待期间这个方法是否占着线程，以及等待结束后由谁执行剩余代码。

### async不会自动安排其他线程

普通地调用一个`async Task`方法时，它先在调用方当前使用的线程上执行。`async`让编译器能够生成支持暂停和恢复的控制流程，本身不会把方法排到后台。

方法执行到`await SomeOperationAsync()`时，也要先调用`SomeOperationAsync()`，拿到可等待的结果（Task），再由await等待这个Task。被调用方法在返回Task之前做的同步工作，同样可能占用当前线程。

举个例子：

```C#
await SomeOperationAsync();
```

可以拆开理解为：

```C#
Task task = SomeOperationAsync(); // 第一步：调用方法，拿到Task
await task;                      // 第二步：等待Task完成
```

这里“拿到Task”不等于“操作已经完成”。Task只是用来表示这项操作的状态。

再看被调用的方法：

```C#
static async Task SomeOperationAsync()
{
    // 故意模拟一个会阻塞当前线程的同步操作
    Thread.Sleep(3000);

    await Task.Delay(1000);
}
```

假设UI线程调用它，过程是：

1. 执行`SomeOperationAsync()`，马上进入这个方法。
2. 执行`Thread.Sleep(3000)`，UI线程被阻塞3秒。这时方法还没有把Task返回给调用方。
3. 执行到`await Task.Delay(1000)`，发现延迟尚未完成，方法暂停，把代表整个方法执行状态的Task返回给调用方。
4. 调用方拿到这个Task，执行自己的`await task`，也暂停等待，UI线程才有机会继续处理界面消息。

所以，虽然方法声明了`async`，前面那3秒的同步操作仍然会卡住界面。

### await与Result

`Task<T>.Result`是同步取结果的属性。任务还没结束时，读取它会阻塞当前线程；任务已成功完成时，则立即返回。

| 取结果的方式 | 任务还没完成 | 已成功完成 |
| --- | --- | --- |
| await task | 挂起方法，不阻塞线程等待 | 直接取结果 |
| task.Result | 阻塞当前线程 | 直接取结果 |

任务如果失败或被取消，Result会抛出异常，不会正常返回库存数量。[官方Result说明](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task-1.result)

两种写法都不会缩短数据库本身的耗时。await的价值在于，等待期间可以把线程留给其他工作。大量库存请求通过Result阻塞等待，可能使可用线程不足、工作排队，出现线程池饥饿，即使CPU没有跑满，接口也可能变慢。[线程池饥饿诊断](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation)

异步查询仍要配合并发限制和连接池管理。释放请求线程，并不意味着数据库可以承受无限并发。

### 什么时候交给线程池执行

调用`Task.Run`时，就会把指定的工作交给线程池，由线程池安排线程来执行。

线程池是.NET管理的一批可以重复使用的线程。把工作交给它，就不需要自己创建和管理线程。

例如，用户点击“生成报表”，报表需要计算几秒。如果让UI线程直接计算，这几秒里界面就可能无法响应点击。

可以在异步按钮事件处理方法中这样写。下面是方法内部的代码片段，假设`BuildReport()`负责计算并返回报表文本，`ShowReport()`负责显示：

```csharp
// 1. 把生成报表的计算交给线程池
Task<string> task = Task.Run(() => BuildReport());

// 2. 等待计算结果，等待期间UI线程可以处理其他界面操作
string report = await task;

// 3. 拿到结果后显示报表
ShowReport(report);
```

执行过程可以分成三步：

1. 执行`Task.Run`，安排线程池中的线程调用`BuildReport()`。返回的Task用来表示这次计算的状态。
2. 执行`await task`。如果计算还没完成，当前按钮处理方法暂停，UI线程可以继续处理鼠标、键盘和窗口刷新。
3. 计算完成后，await取得报表文本。在WPF、WinForms的默认await行为下，这段按钮处理代码会回到UI线程，继续调用`ShowReport()`。

这里交给线程池执行的是`BuildReport()`。后面的`ShowReport()`仍然按照UI程序的规则回到界面线程执行。

启动这次计算的是Task.Run。即使暂时没有写await，计算也已经被安排了；await表达的是“后面的显示步骤需要计算结果，要等结果出来再继续”。[Microsoft：Task.Run](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.run?view=net-8.0)

### 按工作类型选择执行方式

| 工作类型 | 时间主要花在哪里 | 常用方式 |
| --- | --- | --- |
| I/O密集 | 等网络、数据库、文件读写 | 优先调用已有的异步API |
| CPU密集 | 压缩、图像处理、大量计算 | 按需要使用Task.Run或Parallel |

例如，HTTP请求直接使用GetStringAsync；桌面应用为了保持界面响应，把耗时计算显式交给Task.Run。Web服务使用线程池处理请求，在请求里额外套一层Task.Run通常不能增加处理能力，具体边界见后面的Web项目部分。

## 二、用Task.WhenAll等待多个任务

下面用`Task.Delay`模拟三个独立的I/O操作。

```csharp
using System;
using System.Threading.Tasks;

Task<string> userTask = ReadAsync("用户资料");
Task<string> productTask = ReadAsync("商品信息");
Task<string> shippingTask = ReadAsync("物流状态");

string[] results = await Task.WhenAll(
    userTask, productTask, shippingTask);

Console.WriteLine(string.Join("、", results));

static async Task<string> ReadAsync(string name)
{
    await Task.Delay(200);
    return name;
}
```

三个方法先被调用，再统一等待完成。它们的等待时间可以重叠，总耗时通常接近一次等待，再加上调度等开销。

如果每调用一个方法就立即`await`，等它完成才调用下一个方法，执行关系就是串行的。

`Task.WhenAll`负责汇总完成状态，不负责创建线程，也不会自动限制并发量。返回的结果数组按传入任务的顺序排列，完成先后不会改变这个顺序。[Microsoft：Task.WhenAll](https://learn.microsoft.com/dotnet/api/system.threading.tasks.task.whenall)

这种写法适合数量较少、互不依赖的操作。如果一次要处理几十万项数据，就需要先控制并发和等待队列的规模。

## 三、共享变量为什么会出错

下面这段代码，让多个循环迭代共同修改一个计数器。

```csharp
using System;
using System.Threading.Tasks;

int count = 0;

Parallel.For(0, 100_000, _ => count++);

Console.WriteLine(count);
```

预期结果是100000，但实际结果可能更小，也可能碰巧正确。运行一次没有出错，不能说明它是线程安全的。

这里需要注意，在 `Parallel.For`的情况下，10万是循环次数，线程数量由.NET调度决定，可能使用一条或多条线程。这个与 `Task.Run`是不一样的。`Task.Run`本身不会把里面的for自动拆成并行循环。

原因是`count++`包含读取、加一、写回几个步骤，整体不具备原子性。原子性可以理解为：一次操作对其他执行者来说不可分割。

假设初始值为10，两个线程可能这样交错执行：

| 顺序 | 线程A | 线程B |
| --- | --- | --- |
| 1 | 读取10 | |
| 2 | | 读取10 |
| 3 | 计算并写回11 | |
| 4 | | 计算并写回11 |

执行了两次加一，结果只增加了一次。这种结果受执行时序影响的问题，称为竞态条件。

### 多个步骤使用lock

下面的库存类，把检查和扣减放进同一个`lock`。

```csharp
using System;
using System.Threading.Tasks;

var stock = new Stock(1);

Parallel.For(0, 100, _ => stock.TryTake());

Console.WriteLine(stock.Remaining); // 0

public sealed class Stock
{
    private readonly object _gate = new();
    private int _remaining;

    public Stock(int initial) => _remaining = initial;

    public void TryTake()
    {
        lock (_gate)
        {
            if (_remaining <= 0)
                return;

            _remaining--;
        }
    }

    public int Remaining
    {
        get
        {
            lock (_gate)
            {
                return _remaining;
            }
        }
    }
}
```

对同一个`Stock`实例，**只有一个线程能持有这把锁**。检查库存到扣减完成之间，其他使用同一把锁的线程无法插进来，所以最多只有一次`TryTake()`返回。

这里还有一个容易忽略的细节：读取`Remaining`也使用同一把锁。锁只协调遵守同一规则的代码，其他地方绕开锁直接访问字段，就破坏了这套约定。

锁对象要共享且保持稳定。每次调用都新建一个锁对象，调用之间就无法互斥。通常使用私有的`readonly`字段，避免锁住`this`、字符串或`typeof(...)`等可能被其他代码使用的对象。

如果一个流程需要多把锁，应统一获取顺序，减少出现“A拿着锁1等锁2，B拿着锁2等锁1”的死锁。

### 用Interlocked进行原子加减

某实例，用共享变量统计库存查询成功次数。下面是服务类中的代码片段：

```csharp
private static int _successCount = 0;

// 每次库存查询成功后执行
_successCount++;
```

假设1000个请求都查询成功，初始计数为0，并发执行后也不保证得到1000。`++`包含读取、加一和写回，整体不是原子操作。两个线程可能同时读到10，最后都写回11，导致丢失一次计数。

加锁可以保护这几个步骤。对于单个计数器的加一，也可以使用System.Threading中的Interlocked：

```csharp
Interlocked.Increment(ref _successCount);
```

### 死锁

对于死锁，解决方法就是把两个方法统一成先拿锁1，再拿锁2：

```C#
void MethodA()
{
    lock (_lock1)
    {
        lock (_lock2)
        {
            // 执行A的操作
        }
    }
}

void MethodB()
{
    lock (_lock1)
    {
        lock (_lock2)
        {
            // 执行B的操作
        }
    }
}
```


## 四、批量处理可以用Parallel.ForEachAsync

对于较大的异步批量处理，.NET 6及以上提供了`Parallel.ForEachAsync`。它可以按指定并发度推进数据源，省去为每个元素提前创建任务的写法。

```csharp
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

var options = new ParallelOptions
{
    MaxDegreeOfParallelism = 4,
    CancellationToken = cts.Token
};

await Parallel.ForEachAsync(
    Enumerable.Range(1, 20),
    options,
    async (id, token) =>
    {
        await Task.Delay(100, token);
        Console.WriteLine($"处理完成 {id}");
    });
```

这里最多有4个迭代体并发执行，输出顺序不保证与输入一致。[Microsoft：Parallel.ForEachAsync](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.parallel.foreachasync?view=net-6.0)

`4`只是示例参数。实际数值要结合下游配额、数据库连接数、响应时间和服务器负载来决定。对于I/O任务，合理并发量也不必等于CPU核心数。[Microsoft：最大并发度](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.paralleloptions.maxdegreeofparallelism?view=net-6.0)

普通的`Parallel.ForEach`适合同步迭代体。不要直接向它传入异步lambda来等待I/O，否则可能变成`async void`，外层循环无法正确等待这些异步工作。

## 五、集合也需要考虑线程安全

`List<T>`和`Dictionary<TKey, TValue>`不支持任意的并发读写。如果一个线程正在修改集合，另一个线程同时读取或修改，通常需要同步。

常见的并发集合包括：

| 类型 | 常见用途 |
| --- | --- |
| `ConcurrentDictionary<TKey, TValue>` | 多个任务共享键值数据 |
| `ConcurrentQueue<T>` | 多个生产者或消费者访问先进先出队列 |
| `ConcurrentBag<T>` | 不要求顺序的结果收集 |

它们提供线程安全的集合操作，但**不会自动保护集合里可变对象的内部字段**。

例如，可以用`TryAdd`把“键不存在才添加”表达为一次操作：

```csharp
using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

var owners = new ConcurrentDictionary<string, int>();

Parallel.For(0, 100, id =>
{
    if (owners.TryAdd("job-001", id))
    {
        Console.WriteLine($"成功登记 {id}");
    }
});
```

对于这个示例，只有一个调用能成功登记。若改成“先`ContainsKey`，再赋值”，两个动作之间仍然存在被其他任务插入的空隙。

举个例子：

```C#
if (!refreshing.ContainsKey(sku))
{
    refreshing[sku] = true;
    await RefreshStockAsync(sku);
}
```

如果这个SKU最初不在字典里，那么会触发两次刷新。

## 六、并发任务如何取消和报错

任务启动后，还需要有人负责等待完成、处理异常和清理资源。

### 取消通过CancellationToken传递

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));

try
{
    await Task.Delay(TimeSpan.FromSeconds(10), cts.Token);
}
catch (OperationCanceledException) when (cts.IsCancellationRequested)
{
    Console.WriteLine("本次等待已取消");
}
```

取消是一种协作通知。调用方提出停止请求，接收方负责及时响应。它不会强行终止正在执行的任意代码，也不会撤销已经提交的数据库操作。

对于HTTP、数据库等操作，把Token继续传给支持取消的API；自己编写的长循环，可以定期调用`token.ThrowIfCancellationRequested()`。[Microsoft：托管线程中的取消](https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads)

> 要注意的是：如果一个API不响应Token，仅仅在外层设置超时，并不能保证底层工作停止。停止等待和停止执行是两件事。

### 等待并处理所有任务

`await Task.WhenAll(tasks)`会等这些任务全部结束。某个任务失败时，它不会自动取消其他任务。整体失败后，保存下来的汇总任务的`Exception`属性可以用于查看全部故障；单次`await`抛出的异常不能代表所有失败。[Microsoft：异步编程中的异常处理](https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/)

如果业务要求“一项失败就取消其余任务”，需要显式发出取消请求，让其他任务配合响应，然后继续等待它们退出并清理资源。

`Task.WhenAny`同样只负责报告哪个任务先完成，剩余任务还会继续执行。并发工作要有明确的收尾流程，尤其是使用流、数据库连接或其他需要释放的对象时。

## 七、按问题选择工具

| 当前问题              | 可以先考虑                             |
| ----------------- | --------------------------------- |
| 等待一个网络或数据库操作      | 异步API与`await`                     |
| 同时等待少量独立操作        | `Task.WhenAll`                    |
| 对一个计数器进行原子加减      | `Interlocked`                     |
| 同步代码中的多个步骤要共同保持正确 | `lock`                            |
| 异步流程要互斥或限制同时执行的数量 | `SemaphoreSlim.WaitAsync`         |
| 对一批数据进行有上限的异步处理   | `Parallel.ForEachAsync`           |
| 对独立数据进行较重的CPU计算   | `Parallel.For`、`Parallel.ForEach` |
| 多个任务共同修改集合        | 并发集合或明确的同步策略                      |
| 生产和消费速度不一致        | 有容量上限的`Channel<T>`                |
| 多个服务实例共同修改数据库记录   | 数据库约束、条件更新、事务与并发控制                |


