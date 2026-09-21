---
Description: 用容易理解的例子，说明 ASP.NET Core 从读取配置、注册服务到启动服务器的过程。对照 Startup 与 .NET 8 的 Program.cs，讲清 Build、Run 和中间件的分工，以及配置为什么会被覆盖，帮助你读懂项目入口。
Slug: aspnet-core-startup-process-explained
TagRefs:
  - "[[后端]]"
SubTags:
  - "[[CSharp|CSharp]]"
Published: false
Recommend: false
MeechoPolished: true
---

打开一个老项目，你可能会看到 Program.cs 和 Startup.cs 两个文件。打开 .NET 8 项目，启动代码却常常集中在 Program.cs 里，十几行就能把网站运行起来。

代码变短了，应用启动前要做的准备仍然存在：读取配置，准备服务，安排请求的处理流程，最后启动服务器。

把这几件事分清楚，再看不同版本的写法，就容易找到它们之间的联系。

## 一、先认识启动时的几个角色

启动代码里经常出现宿主、服务和中间件这些词。可以先用一个网站的日常工作来理解它们。

| 名称 | 在应用中负责什么 |
| --- | --- |
| 宿主 Host | 管理应用的启动和停止，并组织配置、日志、依赖注入等基础能力 |
| 配置 Configuration | 保存运行所需的设置，例如连接字符串和日志级别 |
| 服务 Service | 提供应用需要的功能，例如订单查询、日志记录 |
| 中间件 Middleware | 处理请求途中的某个环节，例如 HTTPS 重定向、授权检查 |
| 端点 Endpoint | 与请求匹配的处理目标，例如某个控制器操作方法 |

假设用户要查看订单，请求需要找到对应接口，经过适用的检查，再由业务代码读取数据并返回结果。启动代码就是在提前安排这些事情。

配置决定应用按什么设置运行，服务提供要用的能力，管道安排请求如何处理。

## 二、传统项目怎样启动

在 .NET Core 3.x 中，使用通用主机的 Web 项目常见下面的结构。

Program.cs 是入口，负责建立宿主并让它运行：

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

public class Program
{
    public static void Main(string[] args)
    {
        CreateHostBuilder(args).Build().Run();
    }

    public static IHostBuilder CreateHostBuilder(string[] args)
    {
        return Host.CreateDefaultBuilder(args)
            .ConfigureWebHostDefaults(webBuilder =>
            {
                webBuilder.UseStartup<Startup>();
            });
    }
}
```

这段代码可以分成三部分理解。

`Host.CreateDefaultBuilder(args)` 准备一套默认设置，包括从哪里读取配置、怎样记录日志，以及需要哪些基础服务。

`ConfigureWebHostDefaults` 接上 Web 应用所需的能力，例如配置接收 HTTP 请求的 Kestrel 服务器。

`UseStartup<Startup>()` 告诉框架：这个项目自己的服务注册和请求流程，去 Startup 类里找。[通用主机说明](https://learn.microsoft.com/en-my/aspnet/core/fundamentals/host/generic-host?view=aspnetcore-8.0)

Startup.cs 则负责填写应用自己的安排：

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

public class Startup
{
    public Startup(IConfiguration configuration)
    {
        Configuration = configuration;
    }

    public IConfiguration Configuration { get; }

    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();
    }

    public void Configure(
        IApplicationBuilder app,
        IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseHttpsRedirection();
        app.UseRouting();
        app.UseAuthorization();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
        });
    }
}
```

这个类里有三个值得留意的位置：

1. 构造函数接收配置，让后面的启动代码能够读取设置。
2. `ConfigureServices` 注册应用需要的服务。
3. `Configure` 安排中间件和端点，搭建请求处理流程。

例如，`services.AddControllers()` 是把控制器相关服务注册进去。`MapControllers()` 则把控制器操作映射为端点，让符合条件的请求能够找到它们。

前者准备能力，后者安排入口。它们虽然都与控制器有关，却承担着不同的工作。

## 三、这些代码按什么顺序执行

对于上面的传统写法，可以先记住下面的主要步骤：

```text
创建 HostBuilder，设置构建规则
    ↓
调用 Build，准备环境和配置
    ↓
创建 Startup，执行 ConfigureServices
    ↓
建立服务提供程序，完成宿主构建
    ↓
调用 Run，启动宿主
    ↓
框架执行 Configure，搭建请求管道
    ↓
服务器开始接收请求
```

这里省略了内部回调，用来说明主要阶段。阅读其他托管模型时，还需要看它自己的执行方式，不能直接把这张图当作逐行调用顺序。

其中的先后关系很好理解。

Startup 要读取配置，配置就需要先准备好。管道里可能要使用某个服务，这个服务就需要提前注册。等这些准备工作完成，服务器才能按我们安排的方式处理请求。

### 注册服务时，对象已经创建了吗

通常还没有。

服务注册更像是在登记：“有人需要这个接口时，应该提供哪个实现，以及这个实例可以复用多久。”

之后，容器在解析服务时，再按生命周期规则创建或复用对象。因此，执行完 `ConfigureServices`，并不意味着所有业务对象都已经创建了一遍。

### 日志配置放在哪一步

旧代码中还可能出现 `ConfigureHostConfiguration`、`ConfigureAppConfiguration` 和 `ConfigureLogging`。

这些方法分别用来安排宿主配置、应用配置和日志。它们是配置入口，不必把每个名字都画成互相独立的运行阶段。例如，配置日志也会涉及服务注册，并没有一条通用规则要求“全部服务注册结束后，才开始配置日志”。

理解它们各自管什么，比背下一个过于简单的顺序表更有用。

## 四、为什么改了配置却没有生效

假设你在默认配置文件里写了：

```json
{
  "Greeting": "你好"
}
```

又在环境专用的配置文件里写了：

```json
{
  "Greeting": "欢迎来到生产环境"
}
```

同一个键出现了两次，应用最终采用哪个值，要看配置来源的优先级。

以 .NET 8 默认的 `WebApplication.CreateBuilder(args)` 为例，下面越靠后的来源，优先级越高：

```text
宿主配置，作为回退来源
    ↓
appsettings.json
    ↓
appsettings.{Environment}.json
    ↓
开发环境中的用户机密
    ↓
环境变量
    ↓
命令行参数
```

如果当前环境是 Production，通常会加载 `appsettings.Production.json`。它里面的 Greeting 可以覆盖默认文件中的同名设置；如果环境变量又提供了 Greeting，则还会继续覆盖。

所以，排查配置时，要沿着来源往后找。文件里的值正确，不代表运行时最终使用的就是它。

用户机密只会在开发环境且符合相应条件时加载。如果自己又添加了配置来源，还要考虑实际添加顺序：相同键通常由后添加的提供程序覆盖。[默认应用配置来源](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?highlight=appsettings&view=aspnetcore-8.0)

### 宿主配置和应用配置有什么区别

有些设置需要很早确定。例如，当前属于哪个环境，会影响接下来读取哪份环境配置文件。

这类用于引导启动的设置，和业务读取的普通配置项有所区别。环境名称、内容根目录等一旦在早期确定，不能指望后加一份应用配置文件，就把已经完成的启动准备重新改写。

对于 .NET 8 的 `WebApplicationBuilder`，默认宿主配置的优先级从高到低是命令行参数、`DOTNET_` 环境变量、`ASPNETCORE_` 环境变量。旧托管模型可能采用不同顺序，迁移时要分别检查。[宿主环境变量优先级变更](https://learn.microsoft.com/en-us/aspnet/core/breaking-changes/7/environment-variable-precedence?view=aspnetcore-10.0)

## 五、启动代码会随每个请求执行吗

不会。`Startup.Configure` 的任务是在启动时把流程搭好，请求到来后，再执行这个流程中的处理逻辑。

可以把它想成设置一条办事流程：先确认该去哪个窗口，再检查是否有办理权限，最后交给相应人员处理。流程安排好以后，每来一个人，都按已有规则办理，无须重新设置所有窗口。

例如：

- 启动时调用 `UseHttpsRedirection()`，把 HTTPS 重定向中间件加入管道。
- 请求到来后，该中间件判断这次请求是否需要重定向。
- 启动时调用 `MapControllers()`，登记控制器端点。
- 请求匹配到端点后，才执行相应的业务处理。

请求也可能在中途结束。例如某个中间件直接返回响应，后面的业务代码就不会继续执行。

这也是中间件顺序重要的原因。路由选择、身份验证和授权检查之间有依赖，位置放错，实际行为就可能与预期不同。

## 六、换成 .NET 8 写法

从 .NET 6 起，新模板通常使用最小托管模型，把启动安排集中到 Program.cs。下面仍然是控制器应用：

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

可以按四段来读：

```text
CreateBuilder
准备默认配置和基础能力
    ↓
builder.Services
补充应用需要的服务
    ↓
Build，再使用 app.Use 和 app.Map
构建应用，安排请求流程
    ↓
Run
启动应用，等待关闭
```

这里没有显式写出 `Main`，是因为使用了顶级语句，编译器会生成程序入口。入口仍然存在，只是源码少了一层外壳。

默认构建器已经配置了控制台日志，所以不必为了“能在控制台看到日志”再加一次 `AddConsole()`。需要调整日志时，可以通过 `builder.Logging` 处理。

最小托管与 Minimal API 也不是同一个概念。采用这种启动方式，仍然可以像示例一样使用控制器。[ASP.NET Core 基础概览](https://learn.microsoft.com/en-in/aspnet/core/fundamentals/?view=aspnetcore-8.0)

### Build 负责把应用构建起来

`builder.Build()` 根据前面的设置构建宿主和服务提供程序，返回一个 `WebApplication` 对象，也就是这里的 app。

在 .NET 8 中，调用后服务集合会变成只读状态。因此，`builder.Services.AddControllers()` 等注册应放在前面；拿到 app 后，再安排它的中间件和端点。

但 Build 不会开始监听请求。它也不意味着所有服务实例都已创建，或者所有配置值从此固定不变。服务仍按解析需要创建，支持重载的配置仍可以更新。

### Run 负责让应用开始运行

示例最后的无参数 `app.Run()` 启动宿主，让服务器开始工作，并等待应用关闭。

因此，可以把 Build 和 Run 分别理解为“构建好应用”和“让应用运行起来”。

这也解释了新旧写法的一处差别：传统模型由框架在启动过程中调用 `Startup.Configure`；最小托管模型让我们在 Build 之后、Run 之前，直接写下管道配置。

两种写法都要完成准备工作，但具体调用位置并不完全一样。

## 七、旧代码应该搬到哪里

从 Startup 迁移到 Program.cs 时，可以按下面的对应关系整理：

| 原来的工作 | 新写法中的位置 |
| --- | --- |
| 读取配置 | `builder.Configuration` |
| 判断开发或生产环境 | `builder.Environment` 或 `app.Environment` |
| 注册服务 | `builder.Services` |
| 设置日志 | `builder.Logging` |
| 配置中间件 | `app.Use*` |
| 映射端点 | `app.Map*` |
| 启动应用 | `app.Run()` |

启动逻辑多了以后，也可以提取成扩展方法或独立模块，不必把所有细节都堆进 Program.cs。入口保留整体顺序，具体设置放到容易查找的位置即可。

以后遇到启动问题，可以按这个顺序检查：配置最终读到了什么，服务是否在 Build 前注册，请求流程是否安排正确，最后是否调用了 Run。

看清这几件事，十几行的入口代码就不再显得神秘。我们知道应用正在准备什么，也知道出了问题应该往哪里找。
