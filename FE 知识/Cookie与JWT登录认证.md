---
Id: 787aeea32ee742d492a5b55eb063e8b7
Description: 从一次登录讲起，区分Cookie、Session和JWT，再用连续流程解释双Token刷新、强制下线和Okta单点登录。
Slug: jwt-session-best-practices
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JWT|JWT]]"
  - "[[SubTags/Session|Session]]"
Published: true
Recommend: false
MeechoPolished: true
---

用户登录后，每次打开页面、查询订单，都需要让服务器知道自己是谁。

Cookie、Session和JWT分别解决其中一部分问题。

## 先分清三个概念

| 名称 | 做什么 |
| --- | --- |
| Cookie | 浏览器保存的一小段数据，符合发送规则时会自动随请求带上 |
| Session | 服务端保存的登录记录，通常用Session ID查找 |
| JWT | 一种令牌格式，可以携带用户标识、过期时间等信息 |

Cookie里既可以存Session ID，也可以存JWT。JWT也可以由前端放进`Authorization`请求头发送。

因此，讨论登录方案时，需要同时看“凭证是什么”和“凭证怎么发送”。

## Session登录怎么走

以小王登录购物网站为例：

```text
小王输入账号密码
→ 服务端验证成功
→ 创建Session并生成随机Session ID
→ 通过Set-Cookie把ID交给浏览器
→ 浏览器后续请求自动带上Cookie
→ 服务端按ID查到小王的登录记录
```

Session可以存在应用内存、Redis或数据库里。

| 位置 | 主要特点 |
| --- | --- |
| 应用内存 | 配置简单，进程重启后记录可能丢失，多台服务需要额外处理共享问题 |
| Redis | 方便多台服务共享，也方便设置过期时间 |
| 数据库 | 可以持久保存，但要考虑查询压力和清理过期记录 |

这种方式叫有状态认证，因为服务端需要保存并查询会话记录。记录放在内存还是数据库，不影响这个判断。

退出登录时，服务端让Session失效，再清理浏览器的Cookie即可。

## JWT怎么识别用户

常见的签名JWT由三段组成：

```text
header.payload.signature
```

其中payload可以包含用户ID、签发方、接收方和过期时间。签名用于检查令牌是否被篡改，内容通常可以解码读取，所以不适合放密码等秘密。

服务端收到JWT后，需要验证签名、过期时间，以及它是否来自可信签发方、是否发给当前服务。通过验证后，才使用里面的身份信息处理请求。[JWT校验说明](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#jwt)

这个过程可以不查询Session表，因此常被称为无状态认证。但服务端仍需要验签配置，业务也可能需要查询权限或账号状态。

JWT适合让多个获授权的服务独立验签，代价是令牌通常更长，已经发出去的令牌也较难立即撤销。

## 双Token怎么刷新登录

一个常见设计是把Token分成两种：

| Token | 用途 | 示例保存方式 |
| --- | --- | --- |
| Access Token | 调用业务接口，有效期较短 | 前端内存，通过Authorization发送 |
| Refresh Token | 换取新的Access Token，有效期较长 | 浏览器的HttpOnly Cookie，服务端保存校验记录 |

Access Token可以使用JWT。Refresh Token可以是随机字符串，不要求也是JWT；服务端通常保存它的哈希等校验信息。

一次完整流程如下：

1. 登录成功后，前端取得Access Token，浏览器保存Refresh Token Cookie。
2. 查询订单时，前端把Access Token放入`Authorization: Bearer …`请求头。
3. Access Token过期后，前端请求`/refresh`，浏览器按Cookie规则带上Refresh Token。
4. 后端校验通过，返回新的Access Token，并轮换Refresh Token，让旧值失效。
5. 前端重试原来的查询。刷新失败时，再回到登录页。

401也可能表示Token无效等其他认证问题，前端不应无限刷新重试。多个请求同时过期时，可以共用一次刷新结果。

页面重新打开后，内存里的Access Token已经丢失，也可以通过`/refresh`恢复登录。

这里采用固定的最长登录期限：即使Refresh Token不断轮换，也不延长最初约定的截止时间。是否允许续期，是系统自己的策略。[刷新与轮换示例](https://developer.okta.com/docs/guides/refresh-tokens/main/)

存Refresh Token的Cookie可以设置`HttpOnly`和`Secure`，再按站点关系选择`SameSite`。刷新接口仍要处理CSRF；HttpOnly只能限制JS直接读取Cookie，不能代替所有安全防护。

## 强制下线怎么处理

Session方案可以直接撤销服务端的登录记录。

JWT方案需要分两步考虑：

- 撤销Refresh Token，阻止继续换取新的Access Token。
- 如果已有Access Token也要立即失效，可以把它的`jti`加入Redis撤销名单，保存到该Token过期。

业务接口校验JWT时，再检查撤销名单。若要让一个用户所有设备下线，还要撤销该用户各会话的刷新凭证和相应访问凭证。

只删除Refresh Token，已经发出的Access Token通常仍能使用到过期。加入撤销查询后，认证过程也就重新依赖服务端状态了。

## Okta单点登录怎么走

SSO希望实现的是：登录一次身份平台，再进入另一个已接入的应用时，不必重新输入密码。

以应用通过后端接入Okta的OIDC授权码流程为例：

```text
访问应用A
→ 浏览器跳到Okta登录
→ 登录后跳回应用A的callback并带上授权码
→ 应用A后端用授权码换取Token
→ 校验身份后创建自己的Session
→ 通过Set-Cookie建立应用A的登录状态
```

ID Token用来向应用证明登录身份；Access Token用于访问它被授权访问的API。后端可以根据经过校验的身份关联本地用户，再创建本地Session或JWT。[Okta授权码流程](https://developer.okta.com/docs/guides/implement-grant-type/authcode/main/)

用户接着访问应用B时，浏览器再次跳到Okta。Okta如果仍保留有效登录状态，就通常不必再让用户输入密码，但应用B仍要完成自己的回调和身份校验。

Okta的登录Cookie与应用自己的Cookie各属于对应的域名。单点登录通过重定向和协议交换完成，不需要让一个Cookie横跨所有无关域名。

实际接入可以使用成熟的OIDC库，配置回调地址、state和PKCE，并完成ID Token校验。
