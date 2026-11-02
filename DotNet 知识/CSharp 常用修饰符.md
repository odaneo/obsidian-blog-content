
C#修饰符可以从几个问题来理解：谁能访问这个成员，派生类能否改变它，字段能在什么时候赋值，以及成员是否属于某个对象实例。

把这些规则分开看，比把所有关键字记成一张功能表更清楚。

## 访问范围

| 修饰符 | 含义 |
| --- | --- |
| `public` | 在包含类型本身可访问的前提下，对外公开 |
| `private` | 限于声明它的类型内部访问 |
| `protected` | 可由本类型及派生类型访问，另有接收对象等语言规则 |
| `internal` | 限于同一程序集访问 |
| `protected internal` | 同一程序集内，或者符合规则的派生类型可以访问 |
| `private protected` | 限于同一程序集内的本类型及派生类型访问 |

程序集通常对应编译产物中的dll或exe，不等于命名空间。两个类放在相同命名空间里，也可能属于不同程序集。[Microsoft：访问修饰符](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/access-modifiers)

## 继承与重写

| 修饰符        | 用法与含义                          |
| ---------- | ------------------------------ |
| `abstract` | 类不能直接实例化；抽象成员没有具体实现，非抽象派生类需要实现 |
| `virtual`  | 为成员提供默认实现，并允许派生类重写             |
| `override` | 重写继承链中允许重写的成员，包括抽象成员和虚成员       |
| `sealed`   | 用在类上禁止继续继承；用在重写成员上禁止进一步重写      |

下面是一个完整示例：

```csharp
using System;

Animal animal = new Dog();
animal.Speak();
Console.WriteLine(animal.Describe());

public abstract class Animal
{
    public abstract void Speak();

    public virtual string Describe() => "一种动物";
}

public class Dog : Animal
{
    public override void Speak() => Console.WriteLine("汪");

    public sealed override string Describe() => "一只狗";
}
```

`Dog`本身仍然可以被继承，但它的`Describe()`不能再被重写。成员上的`sealed`需要与`override`一起使用。[Microsoft：sealed](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/sealed)

抽象类可以有构造函数、字段以及已经实现的方法，也不一定包含抽象方法。它的限制是不能直接创建该抽象类的实例。[Microsoft：abstract](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/abstract)

## readonly与const

| 对比项 | readonly字段 | const字段 |
| --- | --- | --- |
| 赋值时机 | 声明时，或对应的实例、静态构造函数中 | 声明时提供编译时常量 |
| 能否使用运行时计算结果 | 可以 | 不可以 |
| 是否一定与实例无关 | 不一定，可以是实例字段或静态字段 | 字段隐含为静态，使用时不再加`static` |
| 对引用类型的影响 | 限制字段保存的引用被替换，不冻结对象内容 | 只能使用符合常量规则的值 |

`readonly`不是“整个生命周期只允许赋值一次”。在允许赋值的构造函数中，可以多次赋值；离开这些允许的位置后，才不能再给字段赋新值。

例如，`readonly List<int>`字段不能在普通方法里换成另一个列表，但仍然可以向原列表添加元素。[Microsoft：readonly](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/readonly)

## static属于类型

`static`成员属于类型，通过类型名访问，无需先创建对象。静态方法不能直接使用某个实例的字段，除非先拿到那个实例。

静态类不能实例化，常用于组织工具方法。静态字段则可能被多个调用方共享，因此还需要考虑生命周期和并发访问。加上`static`并不代表线程安全。
