---
Description: 用评论区的例子解释XSS，说明普通文字、富文本和链接该怎样处理，以及CSP能提供哪些额外保护。
Slug: xss-attack-and-prevention
TagRefs:
  - "[[安全]]"
SubTags:
  - "[[SubTags/Web攻击|Web攻击]]"
Published: false
Recommend: false
MeechoPolished: true
---

XSS可以理解为：网站把外来的内容当成了网页代码，导致用户的浏览器执行了攻击者写的脚本。

## 一条评论怎样变成代码

假设页面有一个显示评论的元素`commentBox`，程序把用户输入直接交给`innerHTML`：

```javascript
const userComment = '<img src="missing.png" onerror="alert(1)">';
commentBox.innerHTML = userComment;
```

`innerHTML`会把字符串当作HTML解析。图片加载失败时，浏览器就可能执行`onerror`里的代码，弹出提示框。[innerHTML说明](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML)

这里用弹窗演示。真实攻击可能修改页面、伪造登录框，或以当前用户的身份发送请求。

脚本还可能读取页面里的敏感数据。设置了HttpOnly的Cookie无法被JS直接读取，但这并不能阻止其他XSS危害。

## 常见的三种说法

| 类型 | 怎样发生 | 例子 |
| --- | --- | --- |
| 存储型 | 恶意内容被保存，后来展示给其他用户 | 评论被存入数据库，别人查看时触发 |
| 反射型 | 请求中的恶意内容被服务器直接放进返回页面 | 搜索词被当作HTML输出 |
| DOM型 | 前端代码把不可信内容插入页面，触发脚本 | 把URL参数直接赋给innerHTML |

前两种主要看内容如何到达页面，DOM型强调前端的处理方式，因此它们也可能重叠。

## 普通文字按文字显示

评论如果只需要显示文字，可以改用：

```javascript
commentBox.textContent = userComment;
```

这时浏览器会显示那串字符，不会把它创建成图片，也不会执行其中的事件代码。

React中普通的文本插值也会进行转义：

```jsx
<div>{userComment}</div>
```

服务端模板输出普通文字时，同样使用模板提供的自动转义功能。需要额外小心的是`innerHTML`、`insertAdjacentHTML`和React的`dangerouslySetInnerHTML`，它们允许把内容作为HTML插入。[XSS防护说明](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## 富文本先清洗再展示

如果评论支持加粗、列表和链接，就需要保留一部分HTML。可以使用DOMPurify等工具，去掉危险的标签、事件属性和链接：

```javascript
import DOMPurify from "dompurify";

commentBox.innerHTML = DOMPurify.sanitize(userComment);
```

“清洗”就是留下允许的格式，删除可能执行代码的部分。只删除`<script>`不够，前面的例子用的是图片的`onerror`。

后端也要校验接收的内容，因为前端检查可以被绕过。最终把富文本插入页面时，仍要保证使用的是经过清洗的结果。

## 其他入口怎样处理

| 入口 | 处理方式 |
| --- | --- |
| URL参数显示在页面上 | 当作文字显示；`encodeURIComponent`用于拼接URL参数，不能代替HTML防护 |
| 用户提供的链接 | 检查协议，只接受业务允许的类型，例如http和https |
| 用户上传的SVG | 使用可靠的清洗工具；不需要SVG功能时，可以限制上传类型或转成普通图片 |
| 第三方脚本 | 选择可信来源，固定版本的外部脚本可用SRI检查文件是否被改动 |
| iframe展示不可信HTML | 使用sandbox限制能力，并避免随意放开脚本等权限 |

第三方脚本被篡改属于另一类常见入口，它运行后也可能控制页面。上传文件的安全处理也不能只靠删除某几个关键词。[第三方脚本说明](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html)、[文件上传说明](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## CSP再加一层限制

CSP是一组交给浏览器执行的规则，用来限制脚本等资源的加载和运行。

例如，在Nginx中设置：

```nginx
add_header Content-Security-Policy "script-src 'self'" always;
```

这条规则只允许加载同源脚本，也会阻止直接写在HTML中的脚本和`onerror`等事件代码。[CSP说明](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)

这只是配置示例。有外部脚本或内联脚本的网站，需要按实际情况制定规则。CSP可以减少攻击机会，但普通文字的转义和富文本的清洗仍然需要保留。
