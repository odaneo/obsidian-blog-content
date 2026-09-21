---
Description: 用简单例子介绍React19的主要变化，包括ref传递、表单提交、乐观更新和use读取异步数据。
Slug: react19-updates
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

React19.0增加了一些更省事的写法。日常开发最容易用到的是表单提交、乐观更新和ref传递。下面只讲相对React18的主要变化。

## ref可以直接传

React18中，函数组件接收父组件传来的ref，通常需要套一层`forwardRef`。React19可以直接从props中取出ref，再交给内部的DOM元素。

```jsx
import { useRef } from 'react';

function MyInput({ ref }) {
  return <input ref={ref} />;
}

function App() {
  const inputRef = useRef(null);

  return (
    <>
      <MyInput ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>
        聚焦输入框
      </button>
    </>
  );
}
```

点击按钮后，父组件通过ref让输入框获得焦点。`forwardRef`在React19中仍然能用，只是这种场景可以少写一层。[ref说明](https://react.dev/reference/react/forwardRef)

## 表单提交更省事

以前提交表单，通常要自己处理`onSubmit`、读取输入值，再维护“正在提交”的状态。

React19允许给`<form action={函数}>`传入提交函数。这种通过React管理的提交操作属于Action。配合`useActionState`，可以一起拿到提交结果和等待状态。

下面用等待1秒模拟保存昵称，没有真正调用后端：

```jsx
import { useActionState } from 'react';

async function saveName(previousMessage, formData) {
  const name = formData.get('name');

  await new Promise(resolve => setTimeout(resolve, 1000));
  return `已保存昵称：${name}`;
}

function ProfileForm() {
  const [message, submitAction, isPending] =
    useActionState(saveName, '');

  return (
    <form action={submitAction}>
      <input name="name" placeholder="输入昵称" required />
      <button type="submit" disabled={isPending}>
        {isPending ? '保存中' : '保存'}
      </button>
      <p>{message}</p>
    </form>
  );
}
```

这三个返回值分别是：

- `message`：提交函数返回的结果，这里是“已保存昵称”。
- `submitAction`：交给表单调用的函数。
- `isPending`：是否还在处理中，用来显示“保存中”和禁用按钮。

`previousMessage`是上一次的结果，这个例子里没有用到。`formData.get('name')`读取的是带有`name="name"`的输入框内容。[useActionState说明](https://react.dev/reference/react/useActionState)

如果提交按钮被拆成独立组件，可以在表单内部的按钮组件中使用`useFormStatus`读取提交状态，不必逐层传递`isPending`。它从`react-dom`导入。[useFormStatus说明](https://react.dev/reference/react-dom/hooks/useFormStatus)

## 先显示操作结果

`useOptimistic`用来做乐观更新，也就是请求还没完成，页面先显示操作后的样子。

比如给文章点赞：

```text
点击点赞 → 页面先显示已点赞 → 后台发送请求
```

请求成功后，用服务器确认的结果更新真实状态；请求失败时，临时显示的结果会撤回，页面回到真实状态。失败提示仍然要自己处理。

它管理的是请求期间的临时显示，不代表服务器已经保存成功。[useOptimistic说明](https://react.dev/reference/react/useOptimistic)

## 用use读取异步结果

React19新增`use`，可以读取Promise的结果，并配合`Suspense`显示加载提示。

```jsx
import { Suspense, use } from 'react';

function UserInfo({ userPromise }) {
  const user = use(userPromise);
  return <p>{user.name}</p>;
}

function Page({ userPromise }) {
  return (
    <Suspense fallback={<p>正在加载用户信息</p>}>
      <UserInfo userPromise={userPromise} />
    </Suspense>
  );
}
```

Promise还没完成时，显示“正在加载用户信息”；完成后，`UserInfo`就能读取用户数据。

这里假设`userPromise`已经由外部提供，例如来自服务端组件或支持缓存的数据层。不要在客户端组件每次渲染时直接新建请求，再传给`use`。

`use`也能读取Context，而且允许放在条件或循环里，但仍要在组件或自定义Hook中调用。`useState`等Hook的调用规则没有改变。[use说明](https://react.dev/reference/react/use)

## 其他常见变化

| 变化          | 有什么用                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| Context写法更短 | 原来的`<ThemeContext.Provider value={theme}>`可以写成`<ThemeContext value={theme}>` |
| 支持页面标题和描述   | 可以在组件里写`<title>`和描述用的`<meta>`，React会把它们放到页面的`<head>`中                        |
| 服务端组件正式稳定   | 可以配合支持它的框架在服务端读取数据，再把渲染结果交给客户端                                               |

服务端组件需要框架或构建工具支持，普通客户端项目升级React后不会自动变成服务端渲染。[React19发布说明](https://react.dev/blog/2024/12/05/react-19)

React Compiler是另外配置的编译工具，用来自动做部分缓存优化。仅仅升级React19，不会自动开启它。[React Compiler说明](https://react.dev/learn/react-compiler/introduction)
