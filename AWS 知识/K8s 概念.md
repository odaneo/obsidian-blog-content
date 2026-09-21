---
Description: 从运行一个 Web 应用出发，结合 AWS 类比，用通俗语言梳理 Kubernetes 的 Pod、Deployment、Service、Ingress、配置、存储、扩容与权限。讲清各个组件如何配合，并纠正常见误解，帮助有 AWS 经验的读者入门 K8s。
Slug: kubernetes-basics-for-aws-users
TagRefs:
  - "[[Tags/AWS|AWS]]"
SubTags:
  - "[[SubTags/EKS|EKS]]"
  - "[[SubTags/K8s|K8s]]"
Published: false
Recommend: false
MeechoPolished: true
---

如果你熟悉 AWS，刚接触 Kubernetes 时，最容易困惑的往往是名字：Pod、Deployment、Service、Ingress，每个词似乎都和“运行应用”有关，却又各管一部分。

可以先想象一个普通 Web 应用：它需要服务器运行，需要入口接收请求，需要配置和存储，流量增加时还要扩容。

Kubernetes，简称 K8s，就是用一组相互配合的资源来安排这些工作。

## 一、先看整体关系

AWS 的经验可以帮助理解 K8s，但下面的对应只用于类比，并不代表它们完全相同。

| K8s 概念 | 可以怎样理解 | AWS 类比 |
| --- | --- | --- |
| Cluster | 整个集群，包含管理和运行应用的资源 | 一套完整的运行环境 |
| Node | 承载应用的机器 | 在 EC2 节点模式下，就是 EC2 实例 |
| Pod | K8s 部署和运行容器的基本单位 | 一份正在运行的应用实例 |
| Deployment | 管理应用副本和版本更新 | 类似 ASG 的副本管理，加上发布控制 |
| Service | 为一组应用实例提供稳定入口 | 类似服务发现与内部负载均衡 |
| Ingress | 描述 HTTP、HTTPS 请求如何进入应用 | 类似 ALB 的域名和路径规则 |
| HPA | 根据指标调整应用副本数 | 类似自动扩缩容策略 |

先记住一个关系：

```text
Cluster 里有 Node
Node 上运行 Pod
Deployment 管理应用的 Pod 副本
Service 为这些 Pod 提供稳定的访问入口
```

## 二、Pod 与 Deployment

### Pod 负责运行应用

Pod 里可以有一个或多个紧密配合的容器。入门时，可以先把一个 Pod 理解为一份应用实例。

例如，一个订单 API 运行三个副本，通常就有三个 Pod：

```text
订单 API
├─ Pod A
├─ Pod B
└─ Pod C
```

Pod 不适合被当成一台地址固定、长期不变的服务器。发布新版本、节点故障或手动删除，都可能让旧 Pod 消失，再由控制器创建新的 Pod。

容器进程异常时，也可能只是在原 Pod 内重启容器，并不一定重建整个 Pod。

### Deployment 负责维持你要求的状态

假设你声明：

```text
应用：web
镜像：my-app:v1
副本数：3
```

Deployment 会通过它管理的 ReplicaSet，尽量维持三个副本。如果一个 Pod 被删除，它会安排补建；如果你修改镜像版本，它会安排更新。

这与 ASG 维持 EC2 数量的思路有些相似：你告诉系统希望保持什么状态，系统持续检查并调整实际状态。[Deployment 说明](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

但新 Pod 的 IP 可能与原来不同。其他服务要访问它，就需要一个更稳定的入口。

## 三、Service 与 Ingress

### Service 给应用一个稳定入口

假设订单 API 的三个 Pod 经常替换，调用方总不能每次都修改地址。

Service 就是为了解决这个问题。调用方访问 Service，由它背后的网络机制把请求送到合适的 Pod。

常见做法是通过标签选择后端。例如，Pod 带有：

```yaml
app: web
```

Service 配置相应的选择条件后，K8s 会查找同一 Namespace 中匹配的 Pod，并维护后端地址。通常只有就绪的后端才会接收正常业务流量。

这个查找范围可以跨 Node，不局限在一台机器内部。[Service 说明](https://kubernetes.io/docs/concepts/services-networking/service/)

常见 Service 类型如下：

| 类型 | 主要用途 |
| --- | --- |
| ClusterIP | 提供集群内部访问入口，也是默认类型 |
| NodePort | 通过节点上的指定端口访问服务 |
| LoadBalancer | 在支持的环境中，由相关控制器配置外部负载均衡入口 |

所以，Service 不只用于集群内部访问，具体取决于类型和配置。

### Ingress 描述外部请求怎么分流

假设你希望：

```text
shop.example.com/orders → 订单服务
shop.example.com/users  → 用户服务
```

Ingress 可以描述这样的域名和路径规则，也可以配置 HTTPS 相关入口信息。

不过，Ingress 本身是一份规则，需要 Ingress Controller 读取并实现它，不能直接把 Ingress 等同于 Nginx。[Ingress 说明](https://kubernetes.io/docs/concepts/services-networking/ingress/)

在 EKS 中，使用 AWS Load Balancer Controller 时，可以根据 Ingress 配置创建和管理 ALB：

```text
Ingress 规则
    ↓ 控制器读取并配置
ALB 监听器、路由规则和目标组
```

实际请求经过哪些网络环节，还取决于目标类型。例如，使用 IP 目标模式时，可以简化理解为：

```text
用户 → ALB → Pod IP
```

因此，不宜把流量路径固定写成“ALB → Ingress → Service → Pod”。Ingress 是配置规则，不一定是请求必须经过的一台代理服务器。[EKS 负载均衡说明](https://docs.aws.amazon.com/eks/latest/best-practices/load-balancing.html)

## 四、配置与存储

应用能运行之后，还需要回答两个问题：配置从哪里来，数据保存在哪里？

| 概念 | 保存或提供什么 | 例子 |
| --- | --- | --- |
| ConfigMap | 普通配置 | 日志级别、API 地址、配置文件 |
| Secret | 敏感配置 | 密码、Token、证书和私钥 |
| Volume | 容器可以挂载的文件存储 | 临时共享目录、配置文件、持久化数据 |

ConfigMap 与 Secret 可以把配置和容器镜像分开。应用版本相同，部署到不同环境时，再提供不同配置。

不过，Secret 不等于“放进去就自动安全”。其中常见的 Base64 编码不是加密，仍需要正确设置访问权限和存储加密。[Secret 使用说明](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)

Volume 也不一定持久化。

例如，`emptyDir` 可以供同一个 Pod 中的容器共享临时文件，但 Pod 被移除时，其中的数据也会丢失。需要让数据跨 Pod 重建保留时，通常使用 PVC 申请持久化存储，再通过相应存储驱动接入 EBS、EFS 等服务。[Volume 说明](https://kubernetes.io/docs/concepts/storage/volumes/)

可以简单记成：Volume 解决“容器怎样使用文件存储”，数据能保存多久，要看具体存储类型。

## 五、扩容与发布

### 增加 Pod 和增加机器是两件事

流量增加后，应用可能需要更多副本。但副本最终还得有机器来运行。

| 扩容层面 | 常用组件 | 增加什么 |
| --- | --- | --- |
| 应用副本 | HPA | 调整 Deployment 等工作负载的 Pod 数量 |
| 节点容量 | Karpenter、Cluster Autoscaler | 增加可以运行 Pod 的节点 |

例如，应用原来运行三个 Pod。HPA 根据配置的指标，把期望副本数调整为十个。

如果现有 Node 放不下新增副本，一部分 Pod 就可能因为资源不足处于 Pending 状态。这时还需要节点扩容组件提供更多容量。

HPA 负责“应用需要几份”，节点扩容负责“这些应用放在哪里”。自动扩容需要相应组件和指标配置才能工作。[HPA 说明](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/?session_ref=direct)、[节点扩容说明](https://kubernetes.io/docs/concepts/cluster-administration/node-autoscaling/)

### 发布新版本通常逐步替换

Deployment 默认使用 RollingUpdate，也就是滚动更新。

假设三个 Pod 都运行 v1，发布 v2 时，可以先增加新版本副本，再逐步减少旧版本副本：

```text
原来：v1、v1、v1
过渡：新旧版本暂时并存
完成：v2、v2、v2
```

具体每次增加多少、允许多少副本不可用，由更新策略决定，并不总是严格“一增一删”。还需要合理配置就绪探针，让系统知道新副本是否适合接收请求。[滚动更新说明](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment)

蓝绿发布则是准备两套版本，再切换流量。可以自行组合 Deployment、Service 等资源实现，也可以使用专门的发布控制工具。

## 六、Namespace、权限与排障

### Namespace 把资源分组管理

Namespace 可以理解为集群里的逻辑分区。例如，把开发环境资源放进 `dev`，生产环境资源放进 `prod`，方便命名、管理和授权。

但分到不同 Namespace，不等于自动获得完整的安全隔离。网络访问和操作权限仍需要分别配置。[Namespace 说明](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)

### RBAC 决定谁能做什么

RBAC 是基于角色的权限控制。理解它时，要把“权限规则”和“把权限给谁”分开看：

| 对象 | 作用 |
| --- | --- |
| Role | 定义某个 Namespace 内的权限 |
| ClusterRole | 定义不隶属于某个 Namespace 的权限规则，也能描述 Node 等集群资源的权限 |
| RoleBinding | 在一个 Namespace 中把权限授予用户、组或服务账号 |
| ClusterRoleBinding | 在集群范围绑定权限 |

例如，让开发人员只能查看 `dev` 中的 Pod，可以在 `dev` 创建 Role，再通过 RoleBinding 授权。

ClusterRole 也可以被 RoleBinding 引用，此时相关命名空间资源权限只在该绑定所在的 Namespace 生效。因此，ClusterRole 并不天然等于“平台管理员”或“全局所有权限”。[RBAC 说明](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)

### 排障时先看哪一层出了问题

遇到应用不可用，可以从这些地方开始：

| 观察对象 | 先检查什么 |
| --- | --- |
| Pod | 是否 Pending、是否反复重启、是否 Ready |
| Deployment | 期望副本和可用副本是否一致 |
| Node | CPU、内存是否紧张，节点是否正常 |
| Service | 标签是否选对，EndpointSlice 中是否有可用后端 |
| Ingress 与控制器 | 规则是否生效，负载均衡目标是否健康 |
| HPA | 指标是否可用，是否已达到副本上限 |

状态说明问题发生在哪一层，事件和日志则帮助解释原因。
