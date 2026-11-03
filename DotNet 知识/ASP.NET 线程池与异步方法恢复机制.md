---
Id: "8483976ff1f04ea68adabf3305951437"
Description: 以库存查询为例，说明.NET线程池如何复用线程、异步方法如何在await后恢复执行，并区分异步状态机、ExecutionContext与SynchronizationContext的作用。
Slug: dotnet-thread-pool-async-resumption
TagRefs:
  - "[[Tags/后端|后端]]"
SubTags:
  - "[[SubTags/CSharp|CSharp]]"
Published: true
Recommend: false
MeechoPolished: true
---

## 线程池

.NET线程池负责复用线程，数量会随负载调整，并受配置限制。它既不是固定大小，也不等于CPU核心数；1000个并发请求，也未必需要1000条线程。

通常所说的主线程，是最初执行程序入口的线程。ASP.NET Core启动后，请求一般交给线程池处理，每个请求没有自己的主线程，也不固定占用同一条线程。[官方线程池说明](https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool)

## 异步方法的恢复

下面是库存服务里的方法片段，repository提供真正的异步数据库查询。

```csharp
async Task<string> GetStockMessageAsync(string sku)
{
    string label = $"商品 {sku}";
    int count = await repository.GetAvailableAsync(sku);
    return $"{label}，可售{count}件";
}
```

假设查询还没完成，执行过程如下：

1. 线程A创建label，调用查询方法。
2. await发现查询尚未完成，登记后续逻辑并挂起方法，将尚未完成的`Task<string>`交给调用方。
3. 上层调用链也逐层await后，线程A便可以去做其他工作。
4. 查询结束，线程B取得count，使用label拼接文案，完成整个方法。

查询的`Task<int>`先完成，文案生成后，外层的`Task<string>`才完成。A和B可能是同一条线程，也可能不同。

编译器生成的状态机会保留跨越await仍要使用的label，以及接下来执行的位置。因此，换一个线程也能继续运行，无须让原线程一直停在这里。

async本身不创建线程。如果await时任务已经结束，方法会直接往下执行，不会必然挂起或切换线程。

## 上下文

“恢复上下文”容易把三件事混在一起：

| 机制                     | 负责什么                         |
| ---------------------- | ---------------------------- |
| 异步状态机                  | 记住方法进度和后续所需的数据               |
| ExecutionContext       | 传递AsyncLocal等逻辑环境数据，例如日志关联信息 |
| SynchronizationContext | 为后续代码提供调度方式，例如安排回UI线程        |

ASP.NET Core默认不提供专用的SynchronizationContext，因此后续代码不保证回到原线程。方法需要的数据仍由状态机保留，逻辑环境也通常会随ExecutionContext流转。[上下文说明](https://devblogs.microsoft.com/dotnet/configureawait-faq/)

