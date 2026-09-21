---
Description: 用园区、道路和门禁的类比，讲清 AWS VPC、子网、路由表、Internet Gateway、NAT Gateway、安全组与 NACL 的分工。结合公网访问和私网出站的例子，理解流量怎样找到目的地，以及哪些规则决定能否通过。
Slug: aws-vpc-networking-basics
TagRefs:
  - "[[Tags/AWS|AWS]]"
SubTags:
  - "[[SubTags/Architecture|Architecture]]"
  - "[[SubTags/服务器安全|服务器安全]]"
Published: false
Recommend: false
MeechoPolished: true
---

在 AWS 上创建一台 EC2 后，我们很快会遇到几个问题：它应该放在哪个子网？为什么有公网 IP 还是连不上？私网服务器没有公网 IP，又该怎样下载更新？

这些问题背后，是 VPC 中几个组件的配合。

可以先把 VPC 想成一片自己规划的园区：子网划分区域，路由表指明方向，网关连接外部，安全规则决定哪些通信可以通过。这个类比帮助我们分清职责，实际配置时仍要看地址、路由和访问规则。

下面以常见的 IPv4 网络为例。

## 一、VPC 和子网划分网络范围

### VPC 是应用的虚拟网络

VPC 是 Virtual Private Cloud，通常译为虚拟私有云。它提供一块逻辑隔离的网络，让我们决定资源使用什么地址，以及怎样与其他网络通信。

例如，为 VPC 选择：

```text
10.0.0.0/16
```

这是一段用 CIDR 表示的地址范围。初学时，可以把它理解为这片园区的地址规划。

VPC 提供逻辑隔离，但不意味着永远不能与外界连接。我们仍可以按需要配置互联网访问，或连接其他 VPC、公司网络。

### 子网是地址范围中的一部分

在 VPC 内，可以继续划分子网：

```text
VPC：10.0.0.0/16
├─ 子网 A：10.0.1.0/24
└─ 子网 B：10.0.2.0/24
```

EC2 等资源会放进某个子网，使用该子网范围内的地址。

子网是否属于公有子网，关键看它有没有直接通往 Internet Gateway 的路由。给子网起名 public，并不会自动让它能够上网。

### 可用区决定子网放在哪里

一个 AWS 区域包含多个可用区，简称 AZ。每个 AZ 由一个或多个数据中心组成，基础设施设计考虑了故障隔离。

VPC 可以覆盖同一区域中的多个 AZ，但一个子网只属于一个 AZ。需要跨可用区部署时，就要在相应 AZ 中分别创建子网。[区域与可用区](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)

多个 AZ 能帮助减少单点故障的影响，但不会自动保证应用高可用。应用副本、数据和流量切换，也需要配合安排。[可用区的故障隔离](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/availability-zones.html)

## 二、路由表决定流量往哪里走

有了地址，还需要知道怎样到达目的地。路由表就像园区里的指路牌。

一条路由主要回答两个问题：

| 项目 | 含义 |
| --- | --- |
| 目标地址范围 | 这条规则适用于去哪里的流量 |
| 路由目标 | 把流量交给谁继续处理 |

例如，一张公有子网的路由表可能包含：

| 目标地址范围 | 路由目标 |
| --- | --- |
| 10.0.0.0/16 | local |
| 0.0.0.0/0 | Internet Gateway |

第一条用于 VPC 内部通信。第二条是 IPv4 默认路由，表示没有匹配到更具体路线的流量，交给 Internet Gateway。

所以，访问 VPC 内的 10.0.2.10 时，会优先匹配更具体的内部路由；访问普通互联网地址时，通常走默认路由。

每个子网都关联一张路由表，同一张表可以被多个子网共用。[子网路由表](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html)

路由解决的是“往哪里走”。即使路线存在，流量仍可能被安全规则拦住。

## 三、Internet Gateway 提供互联网通道

Internet Gateway，简称 IGW，是 VPC 与互联网通信的网关。可以把它理解为园区通往外面的出口。

对于直接通过 IGW 联网的 EC2，通常需要同时具备：

1. VPC 已连接 IGW。
2. 所在子网有指向 IGW 的相应路由。
3. 实例有公有 IPv4 地址或弹性 IP。
4. 安全组和 NACL 允许所需通信。

在 IPv4 场景中，IGW 会处理实例私有地址与其公有地址之间的映射。外部访问使用公有地址，实例网卡上使用的仍是私有地址。[Internet Gateway 说明](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html)

因此，“位于公有子网”和“实例能被公网访问”是两件事。子网提供了路线，实例还需要相应地址、放行规则，以及正在监听的服务。

## 四、NAT Gateway 让私网实例主动访问外部

后台服务器通常不需要让互联网直接连接，但仍可能需要下载依赖、安装补丁或调用外部 API。

常见做法是使用公有 NAT Gateway：

```text
私有子网中的 EC2
    ↓
公有子网中的 NAT Gateway
    ↓
Internet Gateway
    ↓
互联网服务
```

在这种架构中：

- 私有子网的默认路由指向 NAT Gateway。
- 公有 NAT Gateway 使用弹性 IP。
- NAT 所在公有子网有通往 IGW 的路由。

多个私网实例可以借助 NAT 的地址和端口转换，对外建立连接。

NAT 常被比作“单向门”，但这句话容易造成误解：它允许内部先发起连接，也允许该连接的响应回来；互联网不能借这条 NAT 路径主动建立到私网实例的新连接。[NAT Gateway 说明](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)

例如，私网服务器请求软件下载站：

```text
服务器发出下载请求 → NAT → 下载站
服务器收到文件数据 ← NAT ← 下载站
```

“不能被外部主动连接”，并不等于“只能发送、不能接收”。

### IGW 与 NAT Gateway 的地址转换

在 IPv4 场景中，两者的区别是：

| 组件 | 地址转换方式 |
| --- | --- |
| IGW | 一对一：实例的私有 IP 对应它自己的公网 IP |
| 公有 NAT Gateway | 常见的单弹性 IP 配置下，多对一：多个私有 IP 共享一个公网 IP |

IGW 的映射可以这样理解：

```text
私有 IP A ↔ 公网 IP A
私有 IP B ↔ 公网 IP B
```

每个私有地址都有对应的公网地址。[IGW 地址转换](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html#ip-addresses-and-nat)

公有 NAT Gateway 则可以通过端口转换，让多个私有地址共用一个公网出口：

```text
私有 IP A ─┐
私有 IP B ─┼→ 同一个公网 IP
私有 IP C ─┘
```

它记录连接对应的地址和端口，将返回数据送回正确的实例。[NAT Gateway 说明](https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html)

## 五、安全组控制资源的访问

安全组，简称 SG，可以理解为资源网卡处的访问规则。对于 EC2，它决定哪些通信可以进入或离开实例。

例如，一台 Web 服务器可以设置：

| 方向 | 示例规则 |
| --- | --- |
| 入站 | 允许需要的客户端访问 TCP 443 |
| 入站 | 仅允许运维来源访问 TCP 22 |
| 出站 | 允许应用需要访问的目标和端口 |

安全组只配置允许规则，没有单独的拒绝规则。未被允许的通信会被阻止。

### 有状态是什么意思

假设入站规则允许用户访问服务器的 443 端口，对应连接的响应可以返回，不必再为了这次响应单独添加出站规则。

同样，实例通过允许的出站规则访问外部服务，对应响应也可以回来。这种会识别连接及其返回流量的行为，就叫“有状态”。[安全组的连接状态](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)

但服务器主动发起一个新连接，仍需要符合相应出站规则。“响应自动允许”不能理解成出站规则没有作用。

### 新建安全组与默认安全组要区分

新建的自定义安全组通常没有入站允许规则，初始出站规则允许全部流量。

VPC 自带的默认安全组则有一条入站规则，允许关联同一安全组的资源之间通信。因此，不能笼统地说所有安全组一开始都拒绝全部入站。[安全组规则](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html)、[默认安全组](https://docs.aws.amazon.com/vpc/latest/userguide/default-security-group.html)

## 六、NACL 控制子网边界的通信

网络 ACL，简称 NACL，是应用在子网边界上的访问规则。

它检查进入和离开子网的流量，可以配置允许，也可以配置拒绝。规则按编号从小到大匹配，遇到第一条匹配规则就采用其结果。

每个子网关联一个 NACL，同一个 NACL 可以供多个子网使用。它不检查同一子网内部资源之间的流量。[NACL 说明](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html)

### 无状态意味着往返都要考虑

NACL 不会因为请求已经放行，就自动允许响应。入站和出站需要分别符合规则。

例如，浏览器使用临时端口 52000，连接服务器的 443 端口：

```text
请求：客户端 52000 → 服务器 443
响应：服务器 443 → 客户端 52000
```

对于服务器所在子网，入站要允许目标端口 443，出站也要允许到客户端临时端口的响应。

52000 只是例子。实际客户端会选择不同临时端口，需要根据通信对象配置合适范围，不能只放行这一个数字。[NACL 与临时端口](https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html)

### 默认 NACL 与自定义 NACL 不同

| 类型 | 初始行为 |
| --- | --- |
| VPC 自带的默认 NACL | 允许入站和出站流量 |
| 新建的自定义 NACL | 在添加允许规则前，拒绝流量 |

两者都能修改规则，所以排障时应查看当前配置，不能只凭“默认”这个名字判断。[默认 NACL](https://docs.aws.amazon.com/vpc/latest/userguide/default-network-acl.html)、[自定义 NACL](https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html)

把它和安全组放在一起看，就容易分清：

| 对比项 | 安全组 | NACL |
| --- | --- | --- |
| 主要范围 | 关联资源的网卡 | 子网边界 |
| 规则类型 | 允许 | 允许或拒绝 |
| 连接状态 | 有状态 | 无状态 |
| 返回流量 | 对应连接的响应自动允许 | 需要相应方向的规则允许 |
| 规则判断 | 汇总允许规则 | 按编号顺序取首条匹配 |

## 七、沿着一条请求检查配置

假设用户直接访问公有子网中 EC2 的 HTTPS 服务，可以按下面的逻辑检查：

```text
用户访问实例公有 IPv4 地址
    ↓
通过 IGW 到达 VPC
    ↓
子网 NACL 允许入站
    ↓
实例安全组允许 TCP 443
    ↓
应用正在监听并处理请求
```

返回时，安全组允许对应连接的响应，NACL 仍需允许出站返回流量；实例所在子网也需要正确的返回路由。

这是一条用于理解的逻辑路径，省略了 AWS 底层网络细节。实际排查时，再检查操作系统防火墙、应用监听地址等设置。

如果问题发生在私网实例下载更新，就换一条路径检查：默认路由有没有指向 NAT，NAT 所在子网能不能到 IGW，往返流量是否被规则阻挡。

读懂 VPC 配置，关键是分清三件事：地址属于哪里，流量准备往哪里走，哪些规则允许它通过。把路线和访问权限分别看清楚，网络问题就更容易找到原因。
