
## 装箱会保存值的副本

```csharp
using System;

int number = 123;
object boxed = number;

number = 456;

Console.WriteLine(number); // 456
Console.WriteLine(boxed);  // 123
```

`object boxed = number`发生装箱。它保存了当时整数值的副本，后面修改`number`，不会同步修改已经装箱的值。

值类型转换为它实现的接口类型时，也可能发生装箱。典型的装箱会带来托管堆分配和数据复制，因此在频繁执行的路径里会增加分配与GC压力。[Microsoft：类型转换与装箱](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/conversions)

## 拆箱要匹配原来的值类型

```csharp
using System;

object boxed = 123;
int number = (int)boxed;

Console.WriteLine(number); // 123

// long wrong = (long)boxed; // 运行时抛出InvalidCastException
long converted = (long)(int)boxed;
Console.WriteLine(converted); // 123
```

盒子里装的是`int`，所以先按`int`拆箱。如果还需要`long`，再进行一次数值转换。

直接写`(long)boxed`是在尝试按`long`拆箱，并不会自动先取出整数再做数值转换。拆箱通常包含类型检查和取值复制；类型不匹配会抛出`InvalidCastException`。[Microsoft：装箱与拆箱](https://learn.microsoft.com/en-gb/dotnet/csharp/programming-guide/types/boxing-and-unboxing)

## 泛型集合能减少这类转换

`ArrayList`以object保存元素，加入int时需要装箱。`List<int>`直接按int保存，添加与读取元素不需要为了转成object而装箱。

不过，使用泛型不表示程序从此没有装箱。如果后续又把int转换成object，或者按需要装箱的接口方式使用它，仍然可能产生相应开销。

阅读代码时，可以先找值类型与object或接口之间的转换，再结合实际的分配测量，判断这些操作是否值得优化。
