
委托是一个类型安全的函数指针，可以用来引用、传递和调用方法。支持将函数赋值、传递和组合调用。它常用于实现回调机制、事件响应和策略注入。使用委托时，所绑定方法的参数个数、类型及返回值必须与委托声明严格一致。

```c#
public delegate void LogHandler(string message);
class Program
{
    public static void LogToConsole(string msg)
    {
        Console.WriteLine("系统日志: " + msg);
    }
    public static void LogToFile(string msg)
    {
        Console.WriteLine("[写入文件] " + msg);
    }
    public static void LogToEmail(string msg)
    {
        Console.WriteLine("[发邮件] " + msg);
    }
    public static void WriteLog(string message, LogHandler handler)
    {
        handler(message); 
    }
    public static void Main()
    {
        LogHandler logger = LogToConsole;
        logger += LogToFile;
        logger += LogToEmail;
        WriteLog("系统启动", logger);
    }
}
```

| 类型 | 含义 | 示例 |
| --- | --- | --- |
| `Action<T>` | 无返回值，接收 T 类型参数 | `Action<User> logger` |
| `Func<T, TResult>` | 返回 TResult，接收 T 参数 | `Func<User, string> getName` |
| `Predicate<T>` | 返回 bool，判断 T 是否满足条件 | `Predicate<User> isActive` |