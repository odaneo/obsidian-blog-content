---
Description: 用请求和后台任务的例子，讲清 ASP.NET Core 依赖注入的三种生命周期、根容器与作用域的区别，以及 IDisposable 资源由谁释放。结合代码说明为什么 Transient 不等于用完即释放，帮助你正确安排服务的使用范围和清理时机。
Slug: aspnet-core-di-lifetime-and-dispose-guide
TagRefs:
  - "[[后端]]"
SubTags:
  - "[[CSharp|CSharp]]"
Published: false
Recommend: false
MeechoPolished: true
---

一个请求处理完了，用到的对象是不是也该释放了？如果它注册成了 Transient，每次获取都是新实例，是不是方法一结束，它就会自动清理？

使用依赖注入时，这两个问题很容易被混在一起。

创建新对象和释放旧对象，分别受不同规则影响。要弄清资源为什么迟迟没有归还，需要一起看三个问题：对象怎样创建，归谁管理，什么时候清理。

本文讨论 ASP.NET Core 使用的 .NET 内置 DI 容器。

## 一、依赖注入帮我们做什么

假设订单服务需要查询数据库、记录日志，还要发送通知。如果它自己创建所有依赖，就得同时知道这些组件的具体实现，以及怎样把它们组装起来。

有了依赖注入，订单服务可以直接声明：“我需要仓储、日志和通知服务。”外部把这些对象交给它，它便可以专注处理订单。

DI 容器负责按照注册关系找到实现、提供依赖，并管理相应实例。这样，替换实现和编写测试都更方便。

但容器需要我们先告诉它：这个服务应该一直复用，还是每次换一个？这就涉及生命周期。

## 二、三种生命周期怎样区分

“解析服务”就是向容器请求一个服务实例。理解这个词后，可以用同一个请求里取两次服务的情形来比较：

| 生命周期 | 同一个请求中取两次 | 换一个请求再取 |
| --- | --- | --- |
| Singleton 单例 | 同一个实例 | 仍复用该实例 |
| Scoped 作用域 | 同一请求作用域中复用 | 新作用域使用另一个实例 |
| Transient 瞬时 | 每次都是新实例 | 仍然每次新建 |

上表假设使用同一应用容器中的同一服务注册，并且每个 HTTP 请求使用自己的作用域。

例如，全局共享的缓存可以考虑单例；一次请求中需要共同使用的数据库上下文，通常采用 Scoped；需要各自独立实例的轻量服务，可以采用 Transient。

通过类型或工厂注册的 Singleton，通常在首次获取时创建。Scoped 则在每个作用域内第一次被请求时创建。`AddDbContext` 默认注册为 Scoped。[服务生命周期说明](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes)

这里最值得记住的是：Transient 保证的是“每次获取都新建”，并没有承诺“当前方法结束就释放”。

Singleton 也不意味着可以随意保存任何依赖。单例如果把 Scoped 服务保存在字段里，后续请求就可能一直使用最初的那个对象，而不是各自作用域中的实例。此外，单例可能被多个请求同时访问，需要考虑线程安全。

## 三、根容器与作用域各管多大范围

应用构建时，通常会创建一个根容器。可以把它理解为跟随整个应用运行的服务管理入口，通过 `IServiceProvider` 获取服务；内置根提供程序的实现是 `ServiceProvider`。

作用域 Scope 则用来管理一段具体工作的服务。对于普通 HTTP 请求，ASP.NET Core 会管理请求作用域；对于后台任务，也可以自己划定范围。

例如，一次后台任务要查询订单、生成结果，任务完成后便不再需要相关服务，就可以创建一个作用域：

```csharp
IServiceProvider root = app.Services;

using var scope = root.CreateScope();

var service = scope.ServiceProvider
    .GetRequiredService<IMySvc>();

// 在当前作用域中使用 service。
```

离开这里的 `using` 范围时，作用域会被释放，它负责管理的可释放实例也会随之清理。

这个范围有多大，要由实际工作决定。HTTP 请求可以按请求划分，后台任务可以按一次任务划分。关键是使用服务的工作应当在作用域结束前完成。

有时为了方便，会把作用域叫作“子容器”。不过，内置 DI 的作用域之间没有层级继承关系，也不会因为一个作用域释放，就自动连带释放另一个作用域。[作用域规则](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines#general-idisposable-guidelines)

根容器通常由宿主在释放时清理。这里说的是正常执行释放流程，不能把进程退出本身当成一定会调用 `Dispose()` 的保证。

## 四、两种获取服务的方式

### 1. 在构造函数中声明需要什么

控制器通常这样获取依赖：

```csharp
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrderController(IOrderService orderService)
    {
        _orderService = orderService;
    }
}
```

框架创建 OrderController 时，会把 IOrderService 的实例传进来。控制器不需要自己去容器里查找，也不需要了解服务怎样创建。

依赖写在构造函数里，读代码时就能看见这个类需要什么。

不过，注入不会改写生命周期。IOrderService 注册为 Singleton，传进来的就是单例；注册为 Scoped，才会在相应作用域内复用。

所以，构造函数注入让依赖更清楚，但仍需要正确选择生命周期。

### 2. 主动向容器获取

也可以直接调用：

```csharp
IServiceProvider root = host.Services;

var service = root.GetRequiredService<IMySvc>();
```

这段代码从宿主的根容器取得服务。写法很短，却需要额外留意：服务是在根作用域里获取的。

对于需要及时释放的服务，获取位置会影响清理时间。同样的注册，从请求作用域获取和从根容器获取，可能得到完全不同的资源占用结果。

## 五、Dispose 和 GC 不是一件事

`IDisposable` 提供了一个明确的清理方法：

```csharp
public interface IDisposable
{
    void Dispose();
}
```

例如，文件流需要关闭文件，数据库连接需要及时归还。有些类没有直接操作这些资源，却持有需要清理的对象，也会实现 IDisposable。

GC 主要负责回收不再可达的托管对象内存，不会自动调用它的 Dispose 方法。即使某些类型有终结器作为兜底，也不能靠它保证及时清理。

可以把两件事分开看：Dispose 结束资源的使用；GC 在之后合适的时候回收对象内存。

当对象交给 DI 管理时，我们还需要弄清楚，究竟是谁负责安排 Dispose。

## 六、对象由谁负责释放

判断释放责任时，不能只看代码里有没有 `new`，还要看对象怎样交给容器。

### 1. 注册类型，由容器管理

```csharp
services.AddSingleton<SomeDisposableService>();
```

容器按注册创建实例，也负责在相应生命周期结束时释放它。

### 2. 注册工厂，返回的实例仍由容器管理

```csharp
services.AddSingleton<SomeDisposableService>(
    _ => new SomeDisposableService());
```

这里的工厂是容器创建服务时调用的方法。虽然方法里写了 new，返回的服务实例仍交给容器管理。[单例类型与工厂注册](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes#singleton)

### 3. 直接注册已有实例，由拥有者管理

```csharp
var service = new SomeDisposableService();

services.AddSingleton(service);

// 在应用不再使用该实例后，由拥有者负责释放。
```

这次是在注册之前就创建好了对象，再把已有实例交给容器使用。内置容器不会自动释放这种实例，开发者需要安排它的清理。[外部实例的释放责任](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines#services-not-created-by-the-service-container)

如果一个对象只供当前方法使用，自己创建并配合 using 也是合理的：

```csharp
using var service = new SomeDisposableService();

// 使用 service。
```

不要因为对象实现了 IDisposable，就认为它必须注册进 DI。更重要的是释放责任清楚：由容器拥有的实例交给容器管理，由自己拥有的实例自行安排清理。

同样，从 DI 获得一个服务后，通常也不应顺手给它套上 using。它可能还要被同一作用域内的其他代码使用，提前释放会打乱容器安排的生命周期。

## 七、从根容器获取为什么会积累资源

三种生命周期在根容器中的表现并不一样：

| 生命周期 | 从根容器获取时需要注意什么 |
| --- | --- |
| Singleton | 本来就计划长期复用，只要符合业务需求，就是预期行为 |
| Scoped | 开启作用域验证会报错；未开启时，会在根作用域中被长期复用 |
| 可释放的 Transient | 每次仍会新建，但实例被根容器保留，等待容器释放时清理 |

以 Transient 为例，假设后台任务每分钟执行一次，每次都从根容器获取一个实现 IDisposable 的服务。

任务结束后，业务不再使用这个实例，但根容器还记着它，因为之后需要负责释放。下一次任务又创建一个，前一个并没有因此消失。

长时间运行下来，就可能留下一批早已完成工作、却仍然占着资源的对象。[可释放瞬时服务的保留问题](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines#disposable-transient-services-captured-by-container)

容器不是永远不会清理，而是清理得太晚。对于持续运行的应用，这种积累仍然可能造成实际的资源泄漏问题。

也要注意适用范围：普通的不可释放 Transient 实例，不会仅因为从根容器获取，就进入释放跟踪列表。但它依赖的可释放对象仍可能被保留。Scoped 实例则还有作用域缓存规则，不能和普通 Transient 混为一谈。

## 八、用代码看释放发生在哪一刻

下面使用同一种 Transient 服务，分别从独立作用域和根容器获取：

```csharp
using System;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

internal static class Program
{
    private static void Main()
    {
        using (IHost host = Host.CreateDefaultBuilder()
            .ConfigureServices(services =>
            {
                services.AddTransient<ITmp, Tmp>();
            })
            .Build())
        {
            var root = host.Services;

            using (var scope = root.CreateScope())
            {
                var a = scope.ServiceProvider
                    .GetRequiredService<ITmp>();

                Console.WriteLine("已获取 a");
            }

            Console.WriteLine("a 所属的作用域已结束");

            var b = root.GetRequiredService<ITmp>();

            Console.WriteLine("已获取 b");
            Console.WriteLine("准备释放宿主");
        }
    }
}

public interface ITmp
{
}

public sealed class Tmp : ITmp, IDisposable
{
    public void Dispose()
    {
        Console.WriteLine("执行 Dispose");
    }
}
```

输出如下：

```text
已获取 a
执行 Dispose
a 所属的作用域已结束
已获取 b
准备释放宿主
执行 Dispose
```

a 属于显式创建的作用域。离开对应的 using 代码块，就会看到第一次 Dispose 输出。

b 在根容器里取得。代码已经打印“已获取 b”，它却不会马上清理，直到离开宿主的 using 范围，才会看到第二次 Dispose 输出。

这段示例说明，Transient 的新建规则并没有失效。真正不同的是对象由哪个作用域管理，而那个作用域什么时候结束。

## 九、实际项目里怎样安排

可以从工作的持续时间倒推服务的管理方式：

1. 普通请求中的业务依赖，优先使用构造函数注入，并核对生命周期是否合适。
2. 后台任务需要 Scoped 服务时，为一段完整工作创建作用域，工作完成后释放作用域。
3. 已由容器管理的可释放 Transient 服务，在合适的作用域内获取，避免不断向根容器索取。
4. 自己创建并拥有的临时资源，用 using 等方式及时清理。
5. 如果对象必须早于作用域结束释放，可以用独立工厂创建、由调用方拥有实例，不要期待 Transient 自动做到这一点。
6. Singleton 偶尔需要使用 Scoped 服务，可以注入 `IServiceScopeFactory`，在显式创建的作用域中完成工作。[单例使用作用域服务](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes#scoped)

这里的“独立工厂”需要和前面的 DI 注册工厂区分。前面的工厂把服务实例返回给容器管理；这里则由调用方获得并管理自行创建的实例，清楚地承担释放责任。

选择生命周期时，不妨多问一句：这段工作结束后，对象还需要继续存在吗？把使用范围和释放责任安排好，容器才能在合适的时间替我们完成清理。
