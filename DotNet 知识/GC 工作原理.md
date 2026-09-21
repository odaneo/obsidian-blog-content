---
Description: 用简单的 C# 代码和示意图，解释 GC 怎样判断对象是否还需要保留、如何回收内存，以及第 0、1、2 代和大对象堆的基本含义。适合第一次了解垃圾回收的读者。
Slug: csharp-gc-basics
TagRefs:
  - "[[后端]]"
SubTags:
  - "[[CSharp|CSharp]]"
Published:
Recommend:
MeechoPolished: true
---

在 C# 中，我们经常用 `new` 创建对象：

```csharp
var person = new Person();
```

对象需要占用内存。程序不停地创建对象，如果这些空间一直不归还，内存迟早会不够用。

.NET 提供了垃圾回收器 GC，帮我们回收已经不再需要保留的对象内存，供后续对象使用。

理解它，可以从一个问题开始：GC 怎么知道哪些对象可以清理？

## 一、变量和对象不是一回事

看下面这段代码：

```csharp
var first = new Person();
var second = first;

public class Person { }
```

这里有两个变量，但只有一个 Person 对象。`second = first` 让 second 也指向原来的对象，并没有复制出一个新对象。

```text
first  ──┐
         ├──→ Person 对象
second ──┘
```

变量与对象之间的这种联系，叫作引用。

可以把对象想成一间房子，引用就是找到它的地址。把地址抄给另一个人，房子不会多出一间。

## 二、GC 怎样判断对象能否回收

GC 会检查：程序还能不能通过保留的引用找到这个对象？

能找到，就需要留下。已经找不到了，普通对象就具备被回收的条件。

例如：

```csharp
Person? first = new Person();
Person? second = first;

first = null;

Console.WriteLine(second is not null); // True

second = null;
```

执行 `first = null`，只是不让 first 再指向 Person。second 仍然指着它，所以对象还不能因此被回收。

等 second 也断开引用，而且没有其他地方保存这个对象，它才有机会被清理。

这里说的是“有机会”，并不是赋值为 null 后，内存马上就释放。GC 会在运行时认为合适的时候进行回收。

### 引用也可能藏在集合里

假设一个列表保存着 Person：

```text
程序仍在使用的列表 → Person 对象
```

即使我们不再通过最初的变量访问 Person，只要这个列表还保留着它，GC 就仍然能够找到它。

这些查找的起点称为 GC Root，初学时把它理解为“程序当前还握着的入口”即可。GC 从这些入口沿着引用往下找，判断哪些对象需要保留。[GC 如何判断对象是否存活](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals#memory-release)

## 三、内存是怎样清理的

可以把一次典型回收想成整理一排储物格。

原来有五个对象，其中 B 和 D 已经找不到任何需要保留它们的引用：

```text
[A 还在用][B 已无用][C 还在用][D 已无用][E 还在用]
```

GC 先找出需要保留的对象，再回收无用对象占据的空间。需要整理时，还会移动留下的对象，让空闲空间更集中：

```text
[A 还在用][C 还在用][E 还在用][空闲空间]
```

后面再创建对象，就可以使用这些空闲空间。

对象移动后，运行时会同步更新有关引用，普通 C# 代码不需要自己处理地址变化。并不是每次回收都会移动对象，这张图只是帮助理解典型的整理过程。[GC 的回收与整理](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/garbage-collection.md)

## 四、为什么要分第 0、1、2 代

程序里的对象，有的只用一小会儿，有的要保留很久。

例如，一次请求中的临时数据，处理完就可能没用了；应用缓存里的数据，则可能持续使用很长时间。

如果每次清理临时对象，都把全部长期对象检查一遍，就会浪费时间。因此，GC 用“分代”的方式减少重复工作。

| 代 | 可以怎样理解 |
| --- | --- |
| Gen 0，第 0 代 | 普通小对象刚创建时通常在这里 |
| Gen 1，第 1 代 | 经历回收后仍然需要保留的过渡区域 |
| Gen 2，第 2 代 | 存活更久的对象所在区域 |

一个普通小对象，通常会经历这样的过程：

```text
刚创建 → Gen 0

Gen 0 回收时还在使用 → 晋升到 Gen 1

Gen 1 回收时还在使用 → 晋升到 Gen 2
```

这里的“代”与经历的回收有关，不是存活几秒就自动升级。对象到了 Gen 2，也仍然可能被后续回收清理。

不同回收的检查范围如下：

| 回收哪一代 | 同时检查哪些代 |
| --- | --- |
| Gen 0 | 第 0 代 |
| Gen 1 | 第 0、1 代 |
| Gen 2 | 第 0、1、2 代 |

这样，GC 经常清理容易变成垃圾的新对象，而不用每次都检查整个堆。[分代回收说明](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals#generations)

## 五、大数组会放在哪里

前面说的是普通小对象。对于较大的对象，.NET 会把它们放到专门的大对象堆中，简称 LOH。

默认情况下，对象总大小达到 85,000 字节，就会进入大对象堆。例如：

```csharp
var buffer = new byte[100_000];
```

这个数组会直接进入 LOH，不必先从第 0 代慢慢晋升。这里的大小包含对象本身的额外开销，不能完全等同于数组元素的数据量。

之所以单独管理，是因为大对象搬动起来成本更高。LOH 通常不会在每次回收时搬动所有存活对象，并且随第 2 代回收一起清理。[大对象堆说明](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap)

例如，读取大文件时，如果每处理一小段就重新创建一个大数组，会增加内存分配和回收的压力。
