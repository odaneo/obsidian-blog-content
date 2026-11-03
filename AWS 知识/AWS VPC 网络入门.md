---
Id: "b94f9c088c1f4dc3ae6d8efb6971508a"
Description: 讲清 AWS VPC、子网、路由表、Internet Gateway、NAT Gateway、安全组与 NACL 的分工。结合公网访问和私网出站的例子，理解流量怎样找到目的地，以及哪些规则决定能否通过。
Slug: aws-vpc-networking-basics
TagRefs:
  - "[[Tags/AWS|AWS]]"
SubTags:
  - "[[SubTags/Architecture|Architecture]]"
  - "[[SubTags/服务器安全|服务器安全]]"
Published: true
Recommend: false
MeechoPolished: true
---

## 一、VPC与子网

VPC是Virtual Private Cloud，即虚拟私有云。它提供逻辑隔离的网络，让我们规划地址，并按需要连接互联网、其他VPC或公司网络。

例如，VPC使用`10.0.0.0/16`，再划出两个子网：

```text
VPC：10.0.0.0/16
├─ 子网A：10.0.1.0/24
└─ 子网B：10.0.2.0/24
```

EC2放入其中一个子网，取得相应范围内的私有地址。CIDR表示这段地址范围，可以把它看成网络的地址规划。

一个VPC能够跨越同一区域内的多个可用区，但每个子网只能位于一个可用区。跨可用区部署时，需要分别建立子网。[区域与可用区](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)

可用区有助于隔离部分故障。应用是否高可用，还取决于副本、数据复制和入口切换，不能只看子网分布。

## 二、路由表

路由表规定去某段地址的流量，应交给哪个目标。每个子网都使用一张路由表，多处子网也可以共用一张表。

公有子网的典型配置如下：

| 目标地址 | 路由目标 |
| --- | --- |
| `10.0.0.0/16` | `local` |
| `0.0.0.0/0` | Internet Gateway |

第一条处理VPC内部通信，第二条是IPv4默认路由。访问`10.0.2.10`会匹配更具体的内部路由；访问普通公网地址时，通常使用默认路由。[子网路由表](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html)

子网直接配置了通往Internet Gateway的路由，才属于这里所说的公有子网。名称里写着public，并不会改变实际通信路径。

路由存在，只说明流量有路可走。能不能通过，还要检查地址和访问规则。

## 三、Internet Gateway

Internet Gateway简称IGW，为VPC提供互联网通道。EC2要直接通过IGW收发IPv4流量，通常需要：

1. VPC挂载IGW。
2. 子网配置对应的IGW路由。
3. 实例具有公有IPv4地址或弹性IP。
4. 安全组、NACL及主机设置允许所需通信。

IGW处理实例私有IPv4地址与其公有地址的映射。客户端访问公有地址，实例网卡本身使用私有地址。[IGW及地址映射](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html)

因此，放在公有子网中的EC2，也不一定能从公网访问。除了地址和路由，应用还必须在正确的地址、端口上监听。

## 四、NAT Gateway

私网服务器不一定需要公开入口，但可能要安装补丁、下载依赖或调用外部API。常见方案是在公有子网中部署公有NAT Gateway：

```text
私网EC2
    ↓ 私有子网默认路由
公有NAT Gateway
    ↓ 公有子网的IGW路由
Internet Gateway
    ↓
互联网
```

这种配置中，私有子网把默认流量交给NAT，NAT关联弹性IP，所在子网再通过IGW联网。

多个私有地址可以借助端口转换共用公网出口。更准确地说，NAT先将源地址转换为自己的私有地址，IGW再将它映射为关联的弹性IP。[NAT Gateway工作方式](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)

NAT允许私网实例发起连接，并把响应送回原来的实例。公网服务无法通过这条NAT路径主动连接私网服务器，所以“只能主动出站”并不意味着收不到返回数据。

| 场景 | 公网地址的使用方式 |
| --- | --- |
| EC2直接经过IGW | 实例使用与自身私有地址对应的公有地址 |
| 私网EC2经过公有NAT | 多台实例可共享NAT关联的公网出口地址 |

## 五、安全组

安全组简称SG，控制关联资源的入站和出站通信。以EC2为例，可以允许用户访问TCP 443，仅让运维来源访问TCP 22，再按应用需要配置出站目标。

安全组只有允许规则。流量没有获得允许，就会被阻止。

它会跟踪连接状态：请求通过入站规则后，对应响应可以直接出站；实例通过出站规则建立的连接，其响应也会放行。这就是“有状态”。[安全组说明](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)

响应被自动允许，不代表主动建立新连接也能忽略规则。服务器另行访问外部接口，仍然需要相应的出站许可。

初始规则还要区分两种情况：

| 安全组类型 | 初始入站规则 | 初始出站规则 |
| --- | --- | --- |
| 新建自定义安全组 | 没有入站允许规则 | 通常允许全部出站 |
| VPC默认安全组 | 允许关联同组的资源相互通信 | 通常允许全部出站 |

这些规则可以修改，排查时以当前配置为准。[安全组规则](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html)、[默认安全组](https://docs.aws.amazon.com/vpc/latest/userguide/default-security-group.html)

## 六、NACL

NACL是子网边界上的网络访问控制列表。它同时支持允许和拒绝规则，按编号升序检查，采用第一条匹配规则的结果。

一个子网关联一个NACL，同一份NACL可供多个子网使用。同一子网内的资源通信，不经过这层规则检查。[NACL说明](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html)

NACL不跟踪连接状态，请求放行后，响应仍要符合另一方向的规则。例如：

```text
请求：客户端52000 → 服务器443
响应：服务器443 → 客户端52000
```

服务器子网的入站规则需要允许目标端口443，出站规则也要覆盖客户端的临时端口。52000只是示例，实际应按通信对象规划端口范围。[临时端口规则](https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html)

默认NACL初始允许双向流量；新建自定义NACL则需要先添加允许规则，否则流量会被拒绝。

| 对比项  | 安全组         | NACL     |
| ---- | ----------- | -------- |
| 生效位置 | 关联资源的网卡     | 子网边界     |
| 规则类型 | 允许          | 允许、拒绝    |
| 连接状态 | 有状态         | 无状态      |
| 返回数据 | 对应连接的响应自动放行 | 往返方向分别配置 |
| 匹配方式 | 汇总允许规则      | 按编号取首条匹配 |

## 七、沿请求路径排查

访问EC2上的HTTPS服务时，可以沿这条简化路径检查：

```text
客户端使用实例公有IPv4地址
    ↓
IGW与子网路由可达
    ↓
NACL允许入站
    ↓
安全组允许TCP 443
    ↓
主机防火墙与应用监听正常
```

返回数据还需要正确的路由，以及NACL的出站许可；安全组会放行已允许连接的响应。

如果故障发生在私网EC2下载更新，就检查另一条路径：私有子网是否指向NAT，NAT能否经过IGW联网，双向规则是否满足要求。
