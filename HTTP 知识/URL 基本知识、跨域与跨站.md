---
---
| **部分**              | **名称**       | **示例值**             |
| ------------------- | ------------ | ------------------- |
| `https://`          | 协议（protocol） | `https`             |
| `www.example.com`   | 域名（domain）   | `www.example.com`   |
| `/api/auth/refresh` | 路径（path）     | `/api/auth/refresh` |

| **对比点** | **跨域（Cross-Origin）** | **跨站（Cross-Site）** |
| --- | --- | --- |
| 维度 | 协议 + 域名 + 端口 | 注册主域名（Site） |
| 判断方式 | URL 三要素是否相同 | eTLD+1 是否一致 |
| 应用场景 | JS 访问、CORS、XHR 请求 | Cookie、CSRF、SameSite 策略 |
| 例如 | `example.com` vs `api.example.com` | `example.com` vs `evil.com`<br>但是 `example.com` vs `api.example.com` 不跨站 |

### Cookie 相关知识

| 属性         | 意义                | 备注                                                                                                                     | 是否可用 Set-Cookie 控制                                                                                              |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| name=value | Cookie 的名字和值      |                                                                                                                        | 可以                                                                                                              |
| Domain     | Cookie 可以发给哪些域名   | 如果不写 `Domain`，默认只属于当前精确域名。比如服务端是：`api.example.com`，不写 `Domain` 时，`Cookie` 只发给：`api.example.com`，不会发给：`www.example.com` | 可以，但是不能设置无关域。比如`api.example.com` 只能设置：`Domain=api.example.com` 或者 `Domain=example.com` ，不能设置成`Domain=other.com` |
| Path       | Cookie 可以发给哪些路径   | `Set-Cookie: token=abc; Path=/app` 会发给`/app`  `/app/user` 等，如果想全站都带，一般写成 `Path=/`                                      | 可以                                                                                                              |
| Max-Age    | 存活秒数              | 如果不写 `Max-Age`，也不写 `Expires`，就变成了 `Session Cookie`，浏览器关闭就失效。                                                           | 可以                                                                                                              |
| Expires    | 过期时间              |                                                                                                                        | 可以                                                                                                              |
| HttpOnly   | 禁止 JS 读取          |                                                                                                                        | 可以                                                                                                              |
| Secure     | 只在 HTTPS 下发送      |                                                                                                                        | 可以                                                                                                              |
| SameSite   | 控制跨站请求是否携带 Cookie | `Lax`：比较常用，普通外链跳转会带，但表单 POST、图片、iframe 这类跨站请求通常不带。<br>`None`：表示跨站也带，但必须同时设置 Secure。                                    | 可以                                                                                                              |

### SameSite 与 CSRF 风险

常见攻击举例

比如用户已经登录了 `bank.com`，用户又访问了攻击网站，网址是 `evil.com`，攻击网站在网页里面偷偷放一个请求：

`<img src="https://bank.com/transfer?to=evil&money=1000">`

如果这个时候，浏览器自动带上 `bank.com` 的登录 Cookie，银行服务器可能以为是用户本人操作。
