---
Description: 用已登录用户被诱导提交请求的例子解释CSRF，说明防伪令牌、SameSite和Authorization请求头各能解决什么问题。
Slug: csrf-attack-and-prevention
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/Web攻击|Web攻击]]"
Published: false
Recommend: false
MeechoPolished: true
---

CSRF就是攻击者借用你的登录状态，让浏览器替你发送一个并非你想执行的操作。

它通常不需要偷到密码，也不需要读到你的Cookie。

## 浏览器为什么会帮忙

假设你已经登录某个网站，浏览器保存了它的身份Cookie。之后请求这个网站时，只要符合Cookie的发送规则，浏览器就会自动带上它。

服务器收到Cookie后能认出你，却不能仅凭Cookie判断这次操作是不是你本人想做的。

攻击者利用的就是这个差别。

## 用转账举个例子

假设一个演示银行站点只检查登录Cookie，没有防伪校验，而且浏览器允许这次跨站请求携带Cookie。

攻击者在另一个网站放入表单：

```html
<form action="https://bank.example/transfer" method="POST" id="transfer">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="10000">
</form>
<script>
  document.getElementById("transfer").submit();
</script>
```

你打开恶意页面后，浏览器提交表单，再按规则附上银行站点的Cookie。银行如果把“已经登录”直接当成“本人同意”，就可能执行转账。

攻击者不一定能读取响应内容，但只要操作已经执行，攻击就可能得逞。

这个例子有前提。显式设置`SameSite=Lax`或`Strict`，通常就能阻止这里的跨站POST携带Cookie。[Cookie发送规则](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

## 防护怎么配合

### 提交时检查防伪令牌

服务端给自己的页面提供一个防伪令牌，也叫CSRF Token。页面提交修改时，除了Cookie，还要把令牌放在表单字段或请求头中。

服务端检查令牌是否有效、是否属于当前会话。外站通常无法读取这个值，就难以拼出有效请求。实际项目可以使用框架提供的防伪功能。

### 用SameSite限制Cookie

| 设置 | 跨站请求中的常见行为 |
| --- | --- |
| Strict | 不携带Cookie，外部链接进入网站时也受影响 |
| Lax | 顶层页面的GET导航可以携带，跨站POST等请求通常不带 |
| None | 允许跨站携带，需要同时设置Secure，仍受浏览器其他限制 |

SameSite按“站点”判断。同一主域下的不同子域可能仍算同站，因此它适合与防伪令牌配合使用。[OWASP防护说明](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

### 写操作不用GET

删除、转账和修改资料等操作使用POST、PUT或DELETE，避免打开链接就改变数据。

不过，前面的攻击表单本身就是POST。换请求方法并不能代替防伪校验。

## JWT也可能遇到CSRF

关键在于凭证怎么发送。

如果前端主动把Token放进`Authorization`请求头，而接口只接受这种认证方式，恶意网站通常无法让浏览器自动补上这段Token。

如果JWT保存在Cookie里，浏览器仍可能自动携带它，CSRF问题也仍然存在。使用Cookie保存Refresh Token时，刷新接口同样需要防护。

`HttpOnly`可以限制JS直接读取Cookie，但不会阻止浏览器发送Cookie，因此不能单独防住CSRF。
