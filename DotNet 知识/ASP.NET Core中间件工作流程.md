
## 请求怎样经过管道

```text
浏览器发出请求
    ↓
Kestrel接收请求
    ↓
ASP.NET Core创建或初始化本次请求的HttpContext
    ↓
中间件A → 中间件B → 匹配的端点
    ↑           ↑
    └── 返回时执行await next之后的逻辑
    ↓
浏览器收到响应
```

正常完成一次调用时，进入顺序是A、B、端点，返回顺序则是端点、B、A。这也是日志、计时和异常处理经常放在外层的原因。

`await next(...)`把工作交给后续管道，并等待它结束。没有调用`next`，就是短路。例如，授权失败可以直接返回响应，后面的业务端点不再执行。

如果后续代码抛出异常，普通的`await next`之后的语句不保证执行；必须进行的清理应放进`finally`。[Microsoft：中间件](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/?view=aspnetcore-8.0)

## 用代码观察顺序

下面适用于.NET 8的ASP.NET Core空项目：

```csharp
using System;
using Microsoft.AspNetCore.Builder;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.Use(async (context, next) =>
{
    Console.WriteLine("A进入");
    await next(context);
    Console.WriteLine("A返回");
});

app.Use(async (context, next) =>
{
    Console.WriteLine("B进入");
    await next(context);
    Console.WriteLine("B返回");
});

app.MapGet("/", () => "Hello");

app.Run();
```

访问根路径后，控制台输出：

```text
A进入
B进入
B返回
A返回
```

Controller、Service和Repository可以组成端点内部的业务调用链，但它们并不因此都成为中间件。

## HttpContext属于本次请求

同一个请求经过这些组件时，通常共享同一个`HttpContext`，可以通过它访问请求与响应。

| 成员 | 用途 |
| --- | --- |
| `Request` | 读取请求路径、请求头、请求体等 |
| `Response` | 设置状态码、响应头和响应体 |
| `User` | 访问认证后的用户身份 |
| `Items` | 在本次请求的组件之间传递数据 |
| `Session` | 启用并正确配置会话后访问会话数据 |

`Items`不会自动跨请求保存。`HttpContext`也不保证线程安全，不应把它保存下来供请求结束后的后台任务继续使用。

## 路由与认证授权的顺序

控制器项目中的常见片段如下，假设服务已经注册完成：

```csharp
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

`UseRouting`匹配端点，认证中间件建立用户身份，授权中间件再结合端点规则判断能否访问。

旧版或使用`Startup`的代码中，还常见`UseEndpoints(endpoints => endpoints.MapControllers())`。.NET 8常见的`WebApplication`写法直接使用`MapControllers()`。最小托管模型会自动安排部分中间件，但需要精确控制执行位置时，可以显式写出相关调用。

认证回答“用户是谁”，授权回答“这个用户能不能访问”。自定义认证方案、会话等功能还需要对应的服务与中间件配置。
