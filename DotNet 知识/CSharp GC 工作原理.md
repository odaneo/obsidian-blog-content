---
Description: 用简单的引用示例，说明 GC 如何寻找存活对象、回收内存，以及分代回收和大对象堆的基本含义。
Slug: csharp-gc-basics
TagRefs:
  - "[[后端]]"
SubTags:
  - "[[CSharp|CSharp]]"
Published: true
Recommend: false
MeechoPolished: true
---

C#用`new`创建对象。.NET运行时中的垃圾回收器GC，负责回收已经不再可达的托管对象内存。关键是判断：程序还能找到它吗？

## 一、变量与对象

```csharp
Person? first = new Person();
Person? second = first;

first = null;
Console.WriteLine(second is not null); // True

second = null;

public class Person { }
```

这里有两个变量，但只有一个Person。`second = first`复制的是引用。

`first = null`断开了first的引用，second仍指向这个对象。等程序不再保留访问它的有效引用，对象才具备被GC回收的条件。

赋值为null不会立即触发回收；GC何时执行，由运行时根据内存分配等情况决定。[Microsoft：自动内存管理](https://learn.microsoft.com/en-us/dotnet/standard/automatic-memory-management)

## 二、GC怎样找对象

GC从局部变量、静态字段等入口出发，沿着引用查找。这些入口称为GC Root，可以先理解为程序仍握着的访问起点。

引用也可能保存在集合中。只要仍在使用的列表保存着Person，GC就可能沿着列表找到它。

GC从这些起点还能找到的对象需要保留；普通对象已经无法到达时，GC才可以回收它的内存。[Microsoft：可达性与回收](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals#memory-release)

### 静态List不断保存对象

例如，程序用一个静态List保存采集到的数据。每次采集都往里面添加对象，数据处理完后却没有从列表里删除。

下面用普通object模拟这些数据对象，代码可以放进.NET 8控制台项目运行：

```csharp
using System;
using System.Collections.Generic;

for (int i = 0; i < 100_000; i++)
{
    Cache.Items.Add(new object());
}

Console.WriteLine(Cache.Items.Count); // 100000

// 业务确认这些数据都不再需要后，清除列表保存的引用。
Cache.Items.Clear();

Console.WriteLine(Cache.Items.Count); // 0

public static class Cache
{
    public static readonly List<object> Items = new();
}
```

添加完以后，这10万个对象都还保存在List里。即使业务上已经处理完，GC仍然可以沿着下面的引用链找到它们：

```text
静态字段Cache.Items → List对象 → 列表内部保存的对象引用 → 数据对象
```

GC不会判断“这条数据已经处理过，应该从List里删除”。只要这条引用链还在，对象就仍然可达，发生GC时也需要保留。

如果一直添加，又没有删除或过期策略，List保留的对象就会越来越多。那些业务上已经不再需要、却仍被引用的对象，就可能形成托管内存泄漏。

`Remove`可以删除指定元素，`Clear`可以清除所有元素的引用。清除后，如果没有其他有效引用，这些数据对象才具备被回收的条件，并不保证内存马上归还。

List本身仍由静态字段引用，而且Clear通常保留列表的内部容量。因此，“清空元素”和“整个List对象被回收”也是两件事。

单例中的List也可能出现同样的问题：单例长时间存活，列表又不断保留旧数据，整条引用链就一直存在。

### 单例持有对象的例子

单例通常会长时间存在。如果它把其他对象保存在字段或集合里，这些对象也可能跟着长期存活。

下面是一个独立的.NET 8控制台示例。PersonCache是单例，它的Current属性保存一个Person对象：

```csharp
using System;

Person? person = new Person { Name = "小林" };
PersonCache.Instance.Current = person;

person = null;

Console.WriteLine(PersonCache.Instance.Current?.Name); // 小林

// 不再需要缓存这个人时，清除单例保存的引用。
PersonCache.Instance.Current = null;

public sealed class PersonCache
{
    public static readonly PersonCache Instance = new();

    public Person? Current { get; set; }

    private PersonCache() { }
}

public sealed class Person
{
    public string Name { get; set; } = "";
}
```

执行`person = null`后，局部变量不再引用Person，但单例的Current仍然保存着它。此时还有这样一条引用链：

```text
静态字段Instance → PersonCache单例 → Current保存的引用 → Person对象
```

GC仍然可以沿着这条引用链找到Person，所以即使这时发生了GC，也不能回收这个Person对象。方法结束、局部变量消失，同样不会自动清除单例中的引用。

执行`PersonCache.Instance.Current = null`，才断开了单例对这个Person的引用。如果没有其他有效引用，Person就具备被回收的条件；何时真正回收，仍由GC决定。PersonCache单例本身仍由静态字段Instance引用，不会因为清空Current而一起消失。

决定对象能否被回收的是引用链。单例只是常见的长期持有者，并不是所有曾经被单例使用过的对象都会一直存活。[Microsoft：GC Root与可达对象](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals#memory-release)

如果单例里的List或Dictionary不断添加数据，又没有删除或过期策略，旧数据就可能一直被保留。业务已经不再需要这些对象，但仍有引用让它们存活，就可能形成托管内存泄漏。DI容器中的Singleton服务也需要注意这种长期持有数据的情况。[Microsoft：单例对内存的影响](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines)

## 三、回收时做什么

可以把一次典型回收理解为整理储物格：

```text
回收前：[A存活][B无用][C存活][D无用]
回收后：[A存活][C存活][空闲空间]
```

GC识别存活对象，回收无用空间，供后续对象使用。需要压缩时，GC还会移动存活对象，运行时负责更新引用；并非每次回收都会搬动对象。[.NET运行时设计说明](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/garbage-collection.md)

## 四、为什么要分代

很多对象很快就不再使用，另一些对象却要保留很久。每次都检查整个堆，成本很高，因此GC采用分代管理。

| 代 | 可以怎样理解 |
| --- | --- |
| Gen 0 | 普通小对象通常从这里开始 |
| Gen 1 | 回收后仍存活的过渡区域 |
| Gen 2 | 存活更久的对象通常在这里 |

普通小对象经历回收仍存活，通常会逐步晋升，不是按秒数升级。Gen 2里的对象也可能被回收。

回收Gen 1时也会检查Gen 0，回收Gen 2时会检查第0、1、2代。这样，GC可以更频繁地处理新对象，减少反复检查长期对象的成本。

## 五、大对象堆

默认情况下，对象总大小达到85,000字节，就会进入大对象堆LOH。例如：

```csharp
var buffer = new byte[100_000];
```

这个数组直接进入LOH，不需要从Gen 0逐步晋升。阈值计算包含对象本身的额外开销，不只是元素数据。

大对象搬动成本较高，LOH通常不会像普通小对象堆那样经常压缩，并随Gen 2回收处理。[Microsoft：大对象堆](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap)

## 六、GC与Dispose

GC主要回收托管内存，不会看到对象实现了`IDisposable`就调用`Dispose()`。

文件和连接等资源，需要由开发者、`using`或DI容器按约定安排清理。具体调用关系见[[IDisposable 与 Dispose 资源释放入门]]。
