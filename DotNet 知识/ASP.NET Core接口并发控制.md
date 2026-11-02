---
Description: 通过库存查询的Controller示例，理解SemaphoreSlim的并发限制、许可归还、异步互斥和单实例边界。
Slug: aspnet-core-semaphoreslim-concurrency
TagRefs:
  - "[[后端]]"
SubTags:
  - "[[CSharp|CSharp]]"
Published: true
Recommend: false
MeechoPolished: true
---

## 用许可控制并发

信号量为操作分配可重复使用的许可。WaitAsync成功后占用一个，结束时通过Release归还。它既能控制数据库查询，也能控制HTTP调用和计算任务，并不保存连接或创建线程。

### Controller示例

示例使用.NET 8及以上的ASP.NET Core项目，保留默认的隐式using。Program.cs启用Controller：

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();

var app = builder.Build();
app.MapControllers();
app.Run();
```

InventoryController.cs实现查询接口：

```csharp
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/inventory")]
public class InventoryController : ControllerBase
{
    // 不同Controller实例共享这两个许可
    private static readonly SemaphoreSlim Gate = new(2, 2);

    [HttpGet("{sku}")]
    public async Task<IActionResult> GetStock(string sku)
    {
        var token = HttpContext.RequestAborted;

        // 不排队，没有许可时直接返回429
        if (!await Gate.WaitAsync(0, token))
        {
            return StatusCode(429, "请求过多，请稍后重试");
        }

        try
        {
            // 模拟库存查询，真实项目替换为异步Repository调用
            await Task.Delay(2000, token);
            return Ok(new { sku, available = 80 });
        }
        finally
        {
            Gate.Release();
        }
    }
}
```

访问`GET /api/inventory/SKU-A`即可调用。延迟两秒和返回库存80仅用于观察行为，接入业务时替换为Repository的异步查询。

Gate是共享的static字段。两个请求取得许可后，其他请求会收到429；前面的操作结束并归还许可，新请求就能进入。谁先取得名额取决于实际执行时序。

### 取得与归还许可

- `new SemaphoreSlim(2, 2)`：初始有两个许可，上限也是两个，数量由代码指定。
- `WaitAsync(0, token)`：立即尝试取得许可，失败返回false；这个例子不排队。
- `finally`中的Release：在已取得许可的前提下，确保异常或取消时也归还名额。

WaitAsync放在try之前，避免等待已取消、根本没有取得许可时仍调用Release。反过来，取得许可却没有归还，会逐渐耗尽可用名额。[WaitAsync说明](https://learn.microsoft.com/en-us/dotnet/api/system.threading.semaphoreslim.waitasync)

### 一个许可实现异步互斥

如果本实例的缓存刷新任务需要逐个执行，下面的lock写法无法编译：

```csharp
lock (_gate)
{
    await RefreshStockAsync(sku);
}
```

C#禁止在lock语句块里写await。普通锁与持有它的线程相关，异步恢复却不保证仍由该线程执行。[官方lock说明](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/lock)

可以共享一个许可。下面是刷新服务的方法片段，RefreshStockAsync表示已有的异步刷新逻辑，并支持取消：

```csharp
private static readonly SemaphoreSlim RefreshGate = new(1, 1);

public async Task RefreshAsync(string sku, CancellationToken token)
{
    await RefreshGate.WaitAsync(token);

    try
    {
        await RefreshStockAsync(sku, token);
    }
    finally
    {
        RefreshGate.Release();
    }
}
```

这里的`WaitAsync(token)`会异步等待名额，不会像前面那样立即拒绝。第一项刷新等待数据库时仍占着许可，后续任务必须等它Release后才有机会进入。

await使线程能够离开当前执行流程，不会替代码归还信号量许可。SemaphoreSlim也不要求取得、归还许可的是同一条线程。

## 使用边界

- 并发数控制同时在途的操作，不等于每秒请求数。需要按时间限制请求量时，可选择固定窗口、滑动窗口或令牌桶。
- static字段只在本进程共享。三个实例各有两个许可，合计可能进入六个操作。全局额度需要在共享层控制，例如API网关。
- 示例保护的是Action中的查询逻辑，MVC后续的结果序列化和响应发送在其范围之外。
- 库存预占的正确性仍由数据库保证。限制并发数量不能代替库存充足才扣减的原子更新。

ASP.NET Core内置的ConcurrencyLimiter可以在HTTP入口配置并发和排队策略；本例展示如何用SemaphoreSlim直接保护指定代码段。[官方限流说明](https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit)

