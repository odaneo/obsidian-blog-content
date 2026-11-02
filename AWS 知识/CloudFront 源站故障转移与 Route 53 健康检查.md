---
Description: 用请求访问与域名解析两个流程，讲清 CloudFront 源站故障转移和 Route 53 健康检查的区别。对比触发方式、缓存影响、切换时间与适用场景，帮助你理解主服务故障后，备用服务怎样接上。
Slug: cloudfront-origin-failover-vs-route53-health-checks
TagRefs:
  - "[[Tags/AWS|AWS]]"
SubTags:
  - "[[SubTags/High Availability|High Availability]]"
Published: true
Recommend: false
MeechoPolished: true
---

主服务不可用时，CloudFront和Route 53都能帮助备用服务接管，但它们处理的环节不同。

CloudFront在回源时尝试另一个内容来源；Route 53通过DNS应答，引导客户端选择另一个访问入口。

## 一、处理环节

| 对比项 | CloudFront源站故障转移 | Route 53主备故障转移 |
| --- | --- | --- |
| 生效环节 | CloudFront回源获取内容 | DNS查询得到解析结果 |
| 判断依据 | 当前回源遇到配置的失败条件 | 健康探测或其他关联的健康信号 |
| 执行动作 | 向备用源站获取本次请求的内容 | 在DNS应答中选择备用入口 |
| 后续请求 | 默认主备模式下，再次回源仍优先请求主源 | 后续解析继续结合健康状态选择记录 |
| 等待因素 | 主源连接、响应超时和重试 | 检测耗时、DNS缓存与客户端重连 |

本文讨论CloudFront普通源组的默认主备行为，以及Route 53的主备DNS路由。

## 二、CloudFront回源故障转移

源组中包含主源站和备用源站。缓存行为关联源组后，处理过程可以简化为：

```text
请求到达CloudFront
    ↓
有可用缓存？
    ├─ 有 → 返回缓存内容
    └─ 无 → 向主源站回源
                  ↓
             命中故障转移条件？
                  ├─ 否 → 正常处理主源响应
                  └─ 是 → 请求备用源站
```

例如，把504设为触发条件后，主源返回504时，CloudFront会尝试备用源。连接失败或等待响应超时，也按相应配置处理。[源站故障转移规则](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html)

这次使用了备用源，不意味着主源被长期停用。下一次请求需要回源时，默认模式还是从主源开始；如果直接命中缓存，则无须再次回源。

源站故障转移适用于GET、HEAD，以及缓存行为允许的OPTIONS。POST、PUT等方法不在此范围内，提交订单失败后不能依靠源组自动重投。[源组请求行为](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorOriginGroups.html)

### 等待时间来自哪里

主源迟迟没有回应时，需要等连接或响应超时、重试达到条件，才能轮到备用源。

如果后续请求仍需回源，也可能再次经历这段等待。是否命中缓存、主源怎样失败、超时与重试如何配置，都会影响响应速度，不能单凭TCP连接复用推断下一次一定更快。

## 三、Route 53改变入口

Route 53可以持续探测端点，支持HTTP、HTTPS、TCP等检查方式，也能关联CloudWatch警报等健康信息。

健康检查负责给出状态。要改变解析结果，还需把状态与DNS记录、路由策略关联；部分AWS别名目标支持直接评估目标健康。[健康检查与记录配置](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-simple-configs.html)

主备路由大致如下：

```text
主入口健康 → 返回主记录
主入口不健康且备用可用 → 返回备用记录
```

Route 53不会接手已经失败的HTTP请求。它改变DNS答案，后续由客户端根据解析结果建立连接。

### DNS切换为何有延迟

从故障发生到用户访问备用服务，通常要经过：

1. 探测确认主入口异常。
2. Route 53调整后续DNS应答。
3. 解析器或客户端更新缓存。
4. 客户端使用新地址重连。

旧解析结果可能仍在缓存中，已有连接也不会自动迁移。因此，TTL只是影响因素之一，不能直接当成业务恢复时间。[DNS缓存与TTL](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/route-53-concepts.html)

## 四、结合场景选择

用户请求一张没有缓存的图片，主源返回了指定错误码，可以由CloudFront继续访问备用源，无须先等待客户端重新解析域名。备用源需要具备相应内容和访问权限。

如果希望主站入口失效后，让后续域名查询指向另一套环境，则可以采用Route 53故障转移，同时把检测和缓存等待纳入恢复目标。[主备路由说明](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-types.html)

两者并没有按“小故障”和“大故障”划界。区域故障同样可能使CloudFront主源失联，选用哪一层接管，取决于实际访问路径。

## 五、验证备用服务

配置切换前，可以围绕四件事验证：

| 验证项 | 关注内容 |
| --- | --- |
| 请求方法 | 是否属于CloudFront允许故障转移的方法 |
| 故障标准 | 状态码、超时和健康信号能否反映业务异常 |
| 备用能力 | 数据、配置、权限及接管容量是否已经具备 |
| 用户等待 | 回源重试、DNS缓存和客户端行为需要多久 |

切换演练应覆盖实际业务。例如，首页能打开，但数据库仍然只读，就不能把备用网站视为已经具备接单能力。
