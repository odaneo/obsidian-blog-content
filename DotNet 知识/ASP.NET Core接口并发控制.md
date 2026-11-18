---
Id: "fbb23823150d4097beb884d226f19d28"
Description: 通过库存查询的Controller示例，理解SemaphoreSlim的并发限制、许可归还、异步互斥和单实例边界。
Slug: aspnet-core-semaphoreslim-concurrency
TagRefs:
  - "[[Tags/后端|后端]]"
SubTags:
  - "[[SubTags/CSharp|CSharp]]"
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

将许可数量设为1，就能实现异步互斥。下面用它控制库存刷新，`RefreshStockAsync`表示已有且支持取消的异步刷新方法：

```C#
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

`WaitAsync(token)`会在没有许可时异步等待。当前刷新在等待数据库期间仍占用许可，后续任务要等它调用`Release()`后才能进入。

异步等待可以让出线程，但不会自动归还许可。`SemaphoreSlim`不要求由同一条线程取得和归还许可，因此可以跨`await`使用。

`lock`则与持有锁的线程绑定，而异步恢复时可能换一条线程。因此，C#不允许在`lock`中使用`await`，下面的写法无法编译：

```C#
lock (_gate)
{
    await RefreshStockAsync(sku);
}
```