---
Description: 用请求访问与域名解析两个流程，讲清 CloudFront 源站故障转移和 Route 53 健康检查的区别。对比触发方式、缓存影响、切换时间与适用场景，帮助你理解主服务故障后，备用服务怎样接上。
Slug: cloudfront-origin-failover-vs-route53-health-checks
TagRefs:
  - "[[Tags/AWS|AWS]]"
SubTags:
  - "[[SubTags/High Availability|High Availability]]"
Published: false
Recommend: false
MeechoPolished: true
---

主服务出了问题，怎样让用户继续访问备用服务？

CloudFront 和 Route 53 都能参与这件事，但它们接手的位置不同：CloudFront 可以在一次符合条件的回源请求失败后，尝试备用源站；Route 53 则根据健康状态，决定域名查询应该返回哪个入口。

先分清“这次请求去哪里取内容”和“域名解析到哪里”，就容易理解两者的区别。

## 一、先看两者各管什么

| 对比项    | CloudFront 源站故障转移     | Route 53 健康检查配合 DNS 故障转移 |
| ------ | --------------------- | ------------------------ |
| 工作位置   | CloudFront 向源站获取内容时   | Route 53 回答 DNS 查询时      |
| 故障判断   | 本次回源是否满足配置的失败条件       | 根据持续探测或其他健康信号判断          |
| 切换动作   | 尝试从备用源站获取本次请求的内容      | 按路由策略返回备用入口              |
| 后续行为   | 默认优先级模式下，下次需要回源仍先尝试主源 | 后续 DNS 查询根据健康状态选择记录      |
| 主要等待时间 | 主源连接、响应超时及重试          | 故障检测、DNS 缓存和客户端行为        |

本文讨论 CloudFront 普通源组的默认主备模式，以及 Route 53 常见的主备 DNS 故障转移。

## 二、CloudFront 怎样尝试备用源站

CloudFront 的源组包含一个主源站和一个备用源站。把相应缓存行为指向源组后，请求大致这样处理：

```text
用户请求内容
    ↓
CloudFront 有可直接使用的缓存？
    ├─ 有 → 返回缓存
    └─ 没有 → 请求主源站
                  ↓
             满足故障转移条件？
                  ├─ 否 → 按正常规则处理响应
                  └─ 是 → 尝试备用源站
```

例如，你把 504 配置为故障转移状态码。主源返回 504 时，CloudFront 就可以尝试从备用源获取这次请求的内容。连接失败和响应超时也有相应的故障转移配置。

这里的重点是“本次请求”。即使上一次已经用过备用源，下一次需要回源时，默认主备模式仍会先尝试主源。它不会因为一次失败，就把后续所有回源请求长期切到备用源。[CloudFront 源站故障转移](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html)

### 哪些请求可以切换

源组故障转移支持 GET、HEAD 和符合缓存行为配置的 OPTIONS 请求。POST、PUT 等方法不适用，不能指望提交订单失败后，CloudFront 自动换个源站再提交一次。

备用源也可能失败，所以配置源组并不等于保证每个请求成功。[源组的请求处理规则](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorOriginGroups.html)

### 为什么切换仍可能很慢

如果主源迟迟不响应，CloudFront 需要等到相应超时或重试条件满足，才会尝试备用源。

后续请求如果命中缓存，可以直接拿到内容；如果仍需回源，就可能再次等待主源失败。因此，不能简单认为“第一次慢，第二次因为复用 TCP 连接就一定快”。

缓存、主源失败的方式，以及连接和响应超时设置，都会影响用户实际等待多久。

## 三、Route 53 怎样改变访问入口

Route 53 的端点健康检查会定期发起探测，不需要等真实用户访问。常见探测协议包括 HTTP、HTTPS 和 TCP，也可以使用 CloudWatch 警报等健康信号。

健康检查本身只负责判断状态。要让状态影响域名解析，还需要把它与相应 DNS 记录和路由策略关联；部分 AWS 别名目标也可以使用目标健康评估。[Route 53 健康检查与记录](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-simple-configs.html)

假设配置了主备故障转移记录：

```text
主入口健康
    ↓
DNS 查询返回主入口

主入口被判定不健康，备用入口可用
    ↓
后续 DNS 查询返回备用入口
```

这与 CloudFront 的动作不同。Route 53 不接收用户的业务请求，也不会替用户把一个已经失败的 HTTP 请求重新发给备用服务器。

它改变的是查询域名时给出的答案。

### 为什么 DNS 切换不是立即完成

从主服务故障到用户改用备用入口，中间可能经历：

1. 健康检查发现并确认故障。
2. Route 53 根据健康状态调整 DNS 应答。
3. DNS 解析器或客户端缓存更新。
4. 客户端使用新的解析结果建立连接。

例如，客户端还缓存着旧地址，即使 Route 53 已经开始返回备用入口，它也可能继续访问原来的地址。已有连接也不会因为 DNS 应答变化就自动迁移。

TTL 会影响缓存保留时间，但不能单独代表全部切换耗时。[DNS 缓存与 TTL](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/route-53-concepts.html)

## 四、放进实际场景里理解

### 内容回源失败

用户通过 CloudFront 请求一张图片，缓存里没有可用内容，主源又返回了已配置的故障状态。

这时可以由 CloudFront 尝试备用源，不需要用户先重新解析域名。前提是备用源能够提供所需内容，并满足访问权限等要求。

### 主站或区域入口故障

应用准备了主、备两套入口，希望主入口不健康时，让后续域名查询引导用户访问备用入口。

这种需求可以考虑 Route 53 的 DNS 故障转移，同时接受故障检测和缓存更新带来的等待。[Route 53 主备故障转移](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-types.html)

两者的区别主要在处理层级，不能简单划成“CloudFront 只管小故障，Route 53 只管大故障”。区域故障也可能表现为 CloudFront 主源不可用，具体怎样接管，要看流量入口和应用架构。

## 五、配置前先确认什么

| 需要确认的问题                  | 为什么重要              |
| ------------------------ | ------------------ |
| 请求是否适用 CloudFront 源组故障转移 | GET 与 POST 的行为不同   |
| 什么情况应该视为主源失败             | 状态码、超时和健康检查要符合业务含义 |
| 备用服务能否接住流量               | 数据、配置、权限和容量都需要准备   |
| 用户可以接受多长等待               | 回源超时与 DNS 缓存都会影响体验 |

如果目标是让符合条件的一次回源请求多一个备用选择，关注 CloudFront 源组。如果目标是根据健康状态改变域名指向，关注 Route 53。

入口能切过去，只完成了故障恢复的一部分。备用服务也能正确处理业务，切换才真正有用。
