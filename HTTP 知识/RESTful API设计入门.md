---
---

REST是一组架构约束。设计HTTP API时，常用URI标识资源，用请求方法表达操作，例如用`GET /users/123`读取用户，用`DELETE /users/123`删除用户。

## 六项架构约束

| 约束 | 含义 |
| --- | --- |
| 客户端与服务器分离 | 界面和服务端处理各自演进 |
| 无状态 | 每次请求包含处理所需的信息，不依赖服务器保存的客户端会话上下文 |
| 可缓存 | 响应说明是否允许缓存及相关条件 |
| 统一接口 | 统一标识资源，通过资源表示进行操作，使用自描述消息和后续操作链接 |
| 分层系统 | 客户端只需与直接相连的一层交互，中间可以有代理、缓存和网关 |
| 按需代码 | 服务器可以提供可执行代码来扩展客户端能力，这一项可选 |

无状态约束针对请求之间的客户端会话依赖，服务器仍然可以保存用户、订单等业务数据。[Fielding的REST定义](https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)

## 常用状态码

| 状态码 | 含义 |
| --- | --- |
| 200 OK | 请求成功，通常返回处理结果 |
| 201 Created | 已创建资源，通常用Location指出新资源地址 |
| 204 No Content | 操作成功，响应没有正文 |
| 400 Bad Request | 请求存在格式等客户端错误 |
| 401 Unauthorized | 缺少有效的身份认证信息 |
| 403 Forbidden | 服务器理解请求，但拒绝处理 |
| 404 Not Found | 未找到目标资源 |
| 409 Conflict | 请求与资源当前状态冲突 |
| 415 Unsupported Media Type | 不支持请求内容的媒体类型等格式 |
| 500 Internal Server Error | 服务器处理请求时发生内部错误 |

状态码应反映实际处理结果，创建、更新和删除操作各自可能有不同响应。[HTTP状态码规范](https://www.rfc-editor.org/rfc/rfc9110.html#section-15)

## 用链接提供后续入口

HATEOAS指通过响应中的链接，引导客户端发现后续操作。例如，获取用户后，可以从响应中找到订单入口：

```json
{
  "id": 123,
  "name": "Neo",
  "links": [
    {"rel": "self", "href": "/users/123"},
    {"rel": "orders", "href": "/users/123/orders"}
  ]
}
```

链接字段的格式和关系含义需要事先约定。

## PATCH的两种常见格式

PATCH用于描述对资源的局部修改，具体含义由补丁格式决定。

| 格式 | Content-Type | 修改名称的例子 |
| --- | --- | --- |
| JSON Patch | `application/json-patch+json` | `[{"op":"replace","path":"/name","value":"Neo"}]` |
| JSON Merge Patch | `application/merge-patch+json` | `{"name":"Neo"}` |

JSON Patch按操作列表执行修改。[RFC 6902](https://www.rfc-editor.org/rfc/rfc6902.html)

JSON Merge Patch通过对象描述变化：省略的字段保持原值，值为`null`的字段会被删除，数组按整体替换。[RFC 7396](https://www.rfc-editor.org/rfc/rfc7396.html)

请求方法与幂等性的区别见[[HTTP请求方法与幂等性]]。
