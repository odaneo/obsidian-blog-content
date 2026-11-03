---
Id: "371411c674894ad99f4c48611476c749"
Description: 用生命周期对照表和作用域示例，说明 Singleton、Scoped、Transient 的区别，以及 using、DI 容器和开发者各自负责的资源释放。
Slug: aspnet-core-di-lifetime-and-dispose-guide
TagRefs:
  - "[[Tags/后端|后端]]"
SubTags:
  - "[[SubTags/CSharp|CSharp]]"
Published: true
Recommend: false
MeechoPolished: true
---

依赖注入DI可以理解为：业务类声明需要什么，容器负责提供对象。

例如，订单服务需要数据库和日志。它可以通过构造函数接收这些对象，而不必自己逐个创建。容器按开发者登记的规则创建、复用，并在约定的时间清理它管理的服务。

这篇文章讨论.NET内置DI容器。

## 一、三种生命周期

| 注册方式 | 对象如何复用 |
| --- | --- |
| `AddSingleton<T>()` | 同一容器中的这份注册共享一个实例 |
| `AddScoped<T>()` | 同一作用域内共享，换作用域就换实例 |
| `AddTransient<T>()` | 每次向容器获取时都创建新实例 |

ASP.NET Core通常为每个HTTP请求管理一个作用域。所以Scoped服务在一次请求中复用，下一次请求使用另一个实例。`AddDbContext`默认采用Scoped。

Singleton常用于需要全局共享的服务，Scoped常用于一次请求的工作，Transient则适合每次获取都需要独立实例的服务。单例可能同时被多个请求访问，需要考虑线程安全。

Transient只规定创建方式，不表示“方法结束，容器马上调用Dispose”。[Microsoft：服务生命周期](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes)

## 二、谁调用Dispose

对于容器创建并管理的可释放服务，可以这样区分：

| 服务 | 谁安排释放 |
| --- | --- |
| Scoped | 所属作用域释放时，由DI容器调用服务的`Dispose()` |
| Transient | 由获取它的作用域跟踪，作用域释放时由DI容器调用`Dispose()` |
| Singleton | 根容器释放时，由DI容器调用`Dispose()` |

普通HTTP请求中，ASP.NET Core框架负责在请求完成后释放请求作用域，作用域再清理它管理的服务。根容器通常由应用宿主负责释放。

DI容器需要根据接口识别清理方法。服务实现`IDisposable`，容器才会按同步释放规则调用`Dispose()`；异步释放使用`IAsyncDisposable`和相应的异步释放流程。

因此，业务代码从DI取得服务后，通常不再单独调用它的`Dispose()`，也不额外给服务套上`using`。[Microsoft：DI释放规则](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines)

## 三、用代码看调用过程

HTTP请求之外，例如一次后台任务，开发者可以自己创建作用域。下面用独立控制台示例观察调用顺序，项目需要引用`Microsoft.Extensions.DependencyInjection`包：

```csharp
using System;
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddScoped<ReportService>();

using var provider = services.BuildServiceProvider();

using (var scope = provider.CreateScope())
{
    var report = scope.ServiceProvider
        .GetRequiredService<ReportService>();

    report.Run();
} // using在这里调用scope.Dispose()。

Console.WriteLine("作用域已结束");

public sealed class ReportService : IDisposable
{
    public void Run() => Console.WriteLine("生成报表");

    public void Dispose()
    {
        Console.WriteLine("ReportService.Dispose已执行");
    }
}
```

输出如下：

```text
生成报表
ReportService.Dispose已执行
作用域已结束
```

调用方分别是：

1. 开发者向容器获取report，容器按注册创建它。
2. 离开代码块时，`using`调用`scope.Dispose()`。
3. DI作用域调用`report.Dispose()`。
4. 当前程序作用域结束时，外层`using var`调用`provider.Dispose()`，释放根容器。

示例中的`Dispose()`只打印信息。实际服务可以在这个方法中关闭自己拥有的流等资源。后台异步任务也应在作用域结束前完成资源使用。

这里的`BuildServiceProvider()`用于独立演示。ASP.NET Core Web项目已有宿主创建的容器，通常直接使用它，不再额外构建一份。

## 四、注册方式也影响释放责任

下面三种注册方式的责任不同：

| 注册写法 | 谁负责最终释放 |
| --- | --- |
| `AddSingleton<ReportService>()` | DI容器 |
| `AddSingleton<ReportService>(_ => new ReportService())` | DI容器 |
| `AddSingleton(existingInstance)` | 该实例的拥有者 |

第二种虽然写了`new`，但工厂是容器调用的，返回的服务仍交给容器管理。第三种把已经存在的实例交给容器使用，内置容器不会替拥有者释放它。

判断责任时，要看实例是否交给容器管理，不能只看有没有`new`。

## 五、根容器为什么容易留住对象

根容器通常跟随应用运行。不断从根容器获取可释放的Transient服务，会不断创建实例；容器又要保留它们，等根容器释放时再调用`Dispose()`。

业务虽然早已用完，对象却仍被容器保存。长期运行时，就可能积累资源。

Scoped服务也不适合直接从根容器获取：开启作用域验证会报错；未开启时，它可能一直留在根作用域里。

普通请求使用框架提供的请求作用域；后台任务需要Scoped服务时，由开发者创建并释放独立作用域。单例需要使用Scoped服务，也可以临时创建作用域，而不是长期保存该服务。

资源清理与GC的区别，见[[IDisposable 与 Dispose 资源释放入门]]和[[CSharp GC 工作原理]]。
