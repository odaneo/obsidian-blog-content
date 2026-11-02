React19.0相对React18，增加了表单Action、乐观更新和更直接的ref传递等能力。

## ref可以直接作为props

React18函数组件接收父组件传来的ref，通常需要forwardRef。React19可以直接从props取得ref，再交给内部DOM：

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

点击按钮后，父组件通过ref聚焦输入框。forwardRef仍可使用。[ref说明](https://react.dev/reference/react/forwardRef)

## 用Action提交表单

form的action可以接收函数。配合useActionState，可以一起取得提交结果、提交函数和等待状态。

下面等待1秒模拟保存昵称，没有调用后端：

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

message是保存结果，submitAction交给表单执行，isPending表示处理中。previousMessage是上一次结果，本例未使用；formData通过输入框的name读取值。[useActionState说明](https://react.dev/reference/react/useActionState)

提交按钮拆成独立组件后，可以在表单内部用react-dom的useFormStatus读取提交状态。

## 乐观更新

useOptimistic用于在请求完成前，先显示预期结果，例如：

```text
点击点赞 → 页面先显示已点赞 → 后台发送请求
```

请求成功后更新真实状态；Action结束或失败时，临时结果会回到真实状态。错误提示仍需自行处理。[useOptimistic说明](https://react.dev/reference/react/useOptimistic)

## 用use读取资源

use可以读取Promise结果，结合Suspense显示加载状态：

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

等待时显示fallback，Promise完成后读取用户数据。这里的userPromise应来自外部提供的稳定资源，例如服务端组件或支持缓存的数据层，避免每次客户端渲染都新建请求。

use也能读取Context，允许在条件或循环中调用，但仍限于组件或自定义Hook。useState等Hook的调用规则保持不变。[use说明](https://react.dev/reference/react/use)

## 其他变化

| 变化 | 用途 |
| --- | --- |
| Context简写 | `<ThemeContext.Provider value={theme}>`可写成`<ThemeContext value={theme}>` |
| 页面元数据 | 组件中的title和描述用meta可放入head |
| 服务端组件稳定 | 配合支持它的框架或构建工具，在服务端读取数据并渲染 |

服务端组件依赖相应的运行和构建支持。[React19发布说明](https://react.dev/blog/2024/12/05/react-19)

React Compiler是需要单独接入的编译工具，用于自动完成部分缓存优化。[Compiler说明](https://react.dev/learn/react-compiler/introduction)
