---
---
## 六大架构约束

| 约束                       | 解释                                                    | 备注           |
| ------------------------ | ----------------------------------------------------- | ------------ |
| 客户端-服务器 (Client-Server)  | 客户端负责 UI，服务器负责存储数据                                    | 职责清晰，相互独立    |
| 无状态性 (Stateless)         | 每次请求包含完整信息，服务器不存储请求状态                                 | 便于扩展、维护      |
| 可缓存 (Cacheable)          | 响应明确表示是否能缓存                                           | 提高效率         |
| 统一接口 (Uniform Interface) | URI统一表示资源，HTTP方法表示操作；资源自描述（JSON/XML），响应包含超链接（HATEOAS） | REST最核心的特征   |
| 分层系统 (Layered System)    | 客户端不关心服务端架构内部细节                                       | 易于扩展，如添加负载均衡 |
| 按需代码 (Code on Demand)    | 可选，服务器可返回可执行代码，如 JavaScript                           | 实践中很少使用      |

## RESTful API 的状态码规范

| 状态码 | 含义 | 用途 |
| --- | --- | --- |
| 200 OK | 成功 | 请求成功，返回数据 |
| 201 Created | 创建成功 | POST 请求成功创建资源 |
| 204 No Content | 操作成功，无数据返回 | PUT/PATCH/DELETE成功后返回 |
| 400 Bad Request | 请求格式有误 | 请求内容格式错误 |
| 401 Unauthorized | 未授权访问 | 身份认证失败 |
| 403 Forbidden | 没有访问权限 | 权限不足 |
| 404 Not Found | 资源不存在 | URI无效或资源已删除 |
| 409 Conflict | 数据冲突，无法处理请求 | PATCH/PUT请求冲突时返回 |
| 415 Unsupported Media Type | 不支持的媒体类型 | 请求中媒体类型有误 |
| 500 Internal Server Error | 服务器内部错误 | 服务器端异常 |

## API 自我发现 (HATEOAS)

API 返回数据中包含相关操作的链接，使客户端能够动态发现并执行下一步操作。

```json
GET /users/123
{
  "id": 123,
  "name": "Neo",
  "links": {
    "self": "/users/123",
    "update": "/users/123",
    "delete": "/users/123",
    "orders": "/users/123/orders"
  }
}
```

## PATCH 方法的特别规范

PATCH 方法 专门用于资源的 部分更新。

| PATCH类型 | MIME类型 | 格式示例 | 特点 |
| --- | --- | --- | --- |
| JSON Patch (RFC 6902) | `application/json-patch+json` | `[{"op":"replace","path":"/name","value":"Neo"}]` | 指令明确，功能更强大 |
| Merge Patch (RFC 7396) | `application/merge-patch+json` | `{"name":"Neo"}` | 简单直观，更易使用 |

### **请求示例**：

JSON Patch:

```json
PATCH /users/123 HTTP/1.1
Content-Type: application/json-patch+json

[
  {"op": "replace", "path": "/name", "value": "Neo"}
]
```

Merge Patch:

```plain text
PATCH /users/123 HTTP/1.1
Content-Type: application/merge-patch+json

{
  "name": "Neo"
}
```
