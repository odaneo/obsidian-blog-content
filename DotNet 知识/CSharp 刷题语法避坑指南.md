---
Description: 系统总结 LeetCode 刷题过程中常见的 C# 语法错误与易混淆点，涵盖数组、List、Dictionary、字符串、循环、堆、字典转列表、接口与实现等高频踩坑场景。每一条都来自真实代码，适合正在用 C# 准备算法面试或刷题的开发者随时查阅。
Slug: csharp-leetcode-syntax-pitfalls-guide
TagRefs:
  - "[[后端]]"
SubTags:
  - "[[CSharp|CSharp]]"
Published: false
Recommend: false
MeechoPolished: false
---
## 1. 数组（Array）

- **声明与初始化**
  - `int[] arr = new int[5];` 创建长度为5的数组，元素默认0。
  - `int[] arr = new int[] { 1, 2, 3 };` 或 `int[] arr = { 1, 2, 3 };`。
  - 空数组：`int[] arr = new int[0];` 或 `int[] arr = Array.Empty<int>();`。
  - 错误：`new int[];`（缺少长度或初始化器）。
  - 错误：`new int[]()`（数组不能使用圆括号调用构造函数）。

- **多维数组**
  - `int[,] dp = new int[m, n];` 是二维数组（矩形），访问用 `dp[i, j]`。
  - `int[][] dp` 是交错数组（数组的数组），访问用 `dp[i][j]`，每行长度可不同。

- **默认值**：数值类型为0，`bool` 为 `false`，引用类型为 `null`。

- **填充数组**
  - `Array.Fill(arr, true);` 将数组所有元素设为 `true`。
  - `Enumerable.Repeat(true, n).ToArray();` 生成填充数组。

- **排序**：`Array.Sort(arr);` 升序；`Array.Sort(arr, (a,b)=>b.CompareTo(a));` 降序（推荐 `CompareTo` 而非 `a-b`）。

---

## 2. 列表（`List<T>`）

- **声明与初始化**
  - `var list = new List<int>();`
  - `var list = new List<int> { 1, 2, 3 };`
  - `List<int> list = new();`（C# 9 目标类型 new）
  - 错误：`new List<new List<int>>()`（泛型类型参数不能写 `new`）。

- **元素数量**：使用 `Count` 属性，不是 `Length`（`Length` 是数组属性）。

- **填充元素**：`Array.Fill(list, true)` 错误，`Array.Fill` 只能用于数组，不能用于 `List`。

- **添加元素**：`list.Add(item);`

- **移除最后一个元素**：`list.RemoveAt(list.Count - 1);`（没有 `Pop()` 方法）。

- **移除第一个元素**：`list.RemoveAt(0);`（模拟队列，但 O(n) 性能差）。

- **排序**：`list.Sort();` 升序；`list.Sort((a,b)=>b.CompareTo(a));` 降序。

- **转换为数组**：`list.ToArray();`

- **查找索引**：`list.FindIndex(item => condition);` 返回第一个匹配索引，未找到返回 -1。

- **判断包含**：`list.Contains(item);`（比较引用或值，对于引用类型如 `List<int>` 比较的是引用，不是内容，需用 `SequenceEqual` 或循环判断）。

- **注意**：`new List<int>(capacity)` 只设置初始容量，`Count` 仍为 0，不能直接索引赋值。要创建指定长度并填充默认值，使用 `new List<int>(new int[n])` 或 `Enumerable.Repeat(default, n).ToList()`。

- **比较真值**：只要两者都实现了 `IEnumerable<T>` 接口且元素类型相同（或可隐式转换），就可以直接使用。所以可以用于 `list` 和 `array` 之间的比较。

```c#
int[] arr = { 1, 2, 3 };
List<int> list = new List<int> { 1, 2, 3 };
bool isEqual = arr.SequenceEqual(list);
```

---

## 3. 字典（`Dictionary<TKey, TValue>`）

- **声明**：`var dict = new Dictionary<string, int>();` 或 `Dictionary<char, int>` 等。

- **安全获取值**：
  ```csharp
  if (dict.TryGetValue(key, out int val)) { /* 存在 */ }
  else { /* 不存在 */ }
  ```

- **更新计数**：
  ```csharp
  dict.TryGetValue(key, out int count);
  dict[key] = count + 1;
  ```

- **索引器访问**：`dict[key]` 若键不存在会抛 `KeyNotFoundException`，因此先 `TryGetValue` 或 `ContainsKey`。

- **转 List**：`dict.ToList()` 得到 `List<KeyValuePair<TKey,TValue>>`，可用于排序等。

---

## 4. 字符串与字符

- **字符串不可变**，不能直接修改 `s[0] = 'x'`。需转为 `char[]`，修改后再 `new string(charArray)`。
  ```csharp
  char[] chars = s.ToCharArray();
  chars[0] = 'x';
  s = new string(chars);
  ```

- **数字字符运算**：`char c = '3'; char next = (char)(c + 1);` 结果为 `'4'`。

- **比较相等**：`s1 == s2` 或 `s1.Equals(s2)`，推荐 `==` 因为空安全。

- **字符串索引**：字符串索引 `s[i]` 返回 `char`，而不是 `string`。

---

## 5. 委托与事件（Action / Func）

- `Action<T1, T2>` 表示无返回值，参数为 T1, T2。

- `Func<T1, T2, TResult>` 表示有返回值，最后一个类型是返回类型。

- 递归 lambda 不能在声明时直接引用自身，需先声明为 null 再赋值，或使用局部函数（推荐）。

---

## 6. 元组与解构

- 方法可返回元组：`public (bool ok, int min, int max) Dfs(...)`。

- 解构：`var (ok, min, max) = Dfs(...);`

- 数组和 `List<T>` 默认不支持解构，需通过索引访问或自定义 `Deconstruct` 扩展方法。

---

## 7. 接口与实现（`IList<T>` vs `List<T>`）

- `IList<T>` 是接口，`List<T>` 是实现类，**接口不能直接实例化**（`new IList<int>()` 错误）。

- 通常声明变量用 `List<T>`，但返回值或参数可用接口类型 `IList<T>` 以增加灵活性。

- 协变问题：`List<List<int>>` 不能直接转换为 `IList<IList<int>>`，因为泛型不变。应使用 `List<IList<int>>` 作为外层容器。

---

## 8. 局部函数与方法

- 可在方法内定义局部函数，使用 `void FuncName(...) { ... }`。

- 局部函数可以访问外层方法的局部变量，适合递归。

## 9. 其他
| 接口               | 核心能力                                      | 含义               |
| ---------------- | ----------------------------------------- | ---------------- |
| `IEnumerable<T>` | `GetEnumerator()`                         | 可迭代，支持 `foreach` |
| `ICollection<T>` | `Count`、`Add`、`Remove`、`Clear`、`Contains` | 可计数、可修改的集合       |
| `IList<T>`       | `this[int]`、`Insert`、`RemoveAt`、`IndexOf` | 有序、可按索引访问        |
`IEnumerable<T>` 对应几乎所有集合；

`ICollection<T>` 对应 `List<T>`、数组、`HashSet<T>`、`Queue<T>` 等可增删的集合；
`IList<T>` 对应 `List<T>`、数组这类可按索引访问的类型。

反过来看：`List<T>` 三种都满足，`HashSet<T>`/`Queue<T>` 满足前两种但不满足 `IList<T>`，`IQueryable<T>` 只满足 `IEnumerable<T>`。