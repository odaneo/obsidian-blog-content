---
Id: "cca96fbf06bd412b8737f9214305a1c6"
Description: 以 1 小时 RTO、15 分钟 RPO 为例，从数据、网络、服务和恢复流程讲解 AWS 异地灾备。用自行部署的 PostgreSQL、Oracle 说明数据库恢复，并结合 S3、Route 53、ALB 和 EC2 介绍业务接管。
Slug: aws-cross-region-disaster-recovery
TagRefs:
  - "[[Tags/AWS|AWS]]"
SubTags:
  - "[[SubTags/High Availability|High Availability]]"
  - "[[SubTags/Architecture|Architecture]]"
  - "[[SubTags/PostgreSQL|PostgreSQL]]"
  - "[[SubTags/Oracle Database|Oracle Database]]"
Published: true
Recommend: false
MeechoPolished: true
---

## 一、恢复目标

| 指标 | 要回答的问题 | 本文目标 |
| --- | --- | --- |
| RTO，恢复时间目标 | 业务中断后，最晚何时恢复？ | 1小时 |
| RPO，恢复点目标 | 可接受的数据缺口有多大？ | 最近15分钟 |

假设下午2点中断，RTO要求下午3点前恢复；RPO要求恢复的数据至少覆盖到下午1点45分。

RTO从服务中断时开始计算，故障发现、决策、环境启动、数据还原和入口切换都占用这段时间。[恢复目标定义](https://docs.aws.amazon.com/prescriptive-guidance/latest/aws-multi-region-fundamentals/fundamental-1.html)

恢复完成也要按业务定义：用户能够登录、查询、提交订单，系统具备约定的处理能力。仅仅打开首页，无法证明业务已经恢复。

## 二、备用环境准备到什么程度

多可用区主要应对区域内的部分故障；整个区域不可用时，需要另一处区域提供接管能力。

常见方案的差别，是备用侧平时已经完成了多少准备：

| 方案 | B区域平时保留什么 | 接管时还要做什么 |
| --- | --- | --- |
| 备份与恢复 | 数据备份、程序和环境定义 | 建环境、还原数据、启动应用 |
| Pilot Light | 持续运行的数据复制等核心部分 | 部署或启动应用，完成业务接管 |
| Warm Standby | 一套完整运行但容量较小的环境 | 数据接管、扩容和流量切换 |
| 多区域双活 | 多个区域都在服务用户 | 将故障区域的流量转移出去 |

Pilot Light保留核心运转能力，Warm Standby则已经具备完整服务，只是规模较小。准备越充分，故障后通常做得越少，持续投入也越高。[AWS灾备策略](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)

1小时RTO无法直接对应某种架构。小系统可能从备份恢复就够用，大系统可能需要常驻数据库副本和备用应用，应由数据量、启动速度和演练结果决定。

以下以单区域写入的主备方案展开。

## 三、数据准备

这里以团队在EC2上自行维护的PostgreSQL或Oracle为例，两者是可选方案。S3保存图片和附件。

服务器由EC2提供，备份、复制、数据库切换仍需自己安排。

### PostgreSQL流复制

先用基础备份建立B区域备用库，再持续传送WAL。WAL记录数据库的变化，备用库通过重放日志更新本地数据。

连接由备用库发起，数据主要从主库传向备用库：

```text
B区域备用库连接A区域主库
    ↓
A区域的WAL Sender发送日志
    ↓
B区域的WAL Receiver接收并落盘
    ↓
备用库重放日志，推进恢复位置
```

流复制默认采用异步方式。主库提交事务时，备用库可能尚未收到日志，也可能已经收到但还没有重放，因此要分别观察传输和重放进度。[流复制说明](https://www.postgresql.org/docs/current/warm-standby.html)

主库故障后，按预案隔离旧主的写入，核对备用库进度，再通过`pg_ctl promote`或`pg_promote()`提升备用库，并让应用重新连接。[故障转移说明](https://www.postgresql.org/docs/current/warm-standby-failover.html)

例如，下午2点中断，而备用库只有截至1点58分的日志，那么之后尚未传来的事务就有丢失风险。是否满足15分钟RPO，要用实际数据进度判断。

### Oracle Data Guard

物理备用库通过接收主库redo，再执行Redo Apply保持同步。它与PostgreSQL的共同思路，是持续复制数据库变化，具体实现和切换工具则不同。

| 操作 | 适用情况 | 主要动作 |
| --- | --- | --- |
| Switchover | 主备能正常通信的计划维护、演练 | 协调交换主备角色 |
| Failover | 原主库已经无法继续服务 | 由备用库接任主库 |

区域故障主要考虑Failover。数据是否完整，取决于保护模式以及故障时日志传输、应用的位置，不能只凭启用了Data Guard就推断零丢失。

Data Guard包含在Oracle企业版中。物理备用库一边应用日志、一边提供只读查询，涉及Active Data Guard的授权范围，部署时需要核对相应许可。[Data Guard与Active Data Guard](https://docs.oracle.com/en/database/oracle/oracle-database/26/haovw/oracle-data-guard.html)

### 备份与历史恢复点

如果不持续运行备用数据库，也可以把备份和日志提前送到B区域，在故障后还原。

PostgreSQL的基础备份配合连续归档WAL，可以恢复到日志覆盖的时间点。Oracle可以用RMAN备份，配合归档redo、控制文件和参数文件等材料恢复。[PostgreSQL时间点恢复](https://www.postgresql.org/docs/current/continuous-archiving.html)、[RMAN恢复材料](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/getting-started-rman.html)

这些文件可经上传和复制流程保存在异地S3。S3保存恢复材料，数据库还原仍由对应工具完成。

每15分钟执行一次备份，并不自动满足15分钟RPO。要看B区域实际拿到了哪些完整材料，能恢复到哪里。取回文件、还原数据、重放日志和验证业务，也都计入RTO。

数据库副本之外仍要保留历史备份。误删可能被复制到备用库，此时需要回到错误发生前。误删和损坏的发现、恢复耗时，应与区域故障分别演练。

### S3对象复制

跨区域复制可以把符合规则的新对象送到B区域，但过程是异步的。启用前已经存在的对象，需要通过S3 Batch Replication等方式补齐。[S3复制说明](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)

应用恢复时，还要切换存储桶配置并读取实际文件。数据库记录已经恢复，而附件尚未复制完成，订单页面依然可能无法正常使用。

## 四、网络准备

B区域应有能够独立运转的访问路径：

| 组件 | 准备内容 |
| --- | --- |
| VPC、子网、路由 | 应用和数据库所需的网络 |
| ALB与ACM证书 | 业务域名的HTTP、HTTPS入口 |
| 安全组 | 入口到应用、应用到数据库的必要通信 |
| IGW、NAT或VPC Endpoint | 按资源类型和依赖安排公网、出站及AWS服务访问 |
| 跨区域连接 | 供平时数据库复制使用的通信路径 |

可用CloudFormation管理环境定义，两边采用一致的部署结构，单独配置区域资源与地址。网络组件的分工可以结合[[AWS VPC 网络入门]]查看。

数据库复制可通过跨区域VPC Peering等方式走私有地址，但两侧路由和访问规则也要配齐。[VPC Peering说明](https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html)

接管之后，B区域应用应访问本区域的新主库。调用外部接口、读取配置、取回部署材料，也不能仍依赖A区域的代理或出口。

### Route 53入口切换

主环境平时接收流量，备用业务就绪后，可由Route 53的主备路由将后续解析导向备用入口。

健康信号需要反映业务是否可接单。备用数据库还只读、应用尚未启动时，首页返回成功不足以作为接管依据。

DNS缓存和已有连接会延迟客户端转向新入口。TTL、重试和重连都应在演练中观察，不能把更新DNS记录当成业务立即恢复。[主备故障转移](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-types.html)

## 五、应用准备

### 程序与容量

.NET应用可由EC2和Auto Scaling Group运行。Pilot Light在故障后启动应用，Warm Standby则先运行少量实例，接管时扩容。

所需AMI、发布包和启动模板应提前在B区域可用；生产版本升级时，也要同步维护备用侧的材料，防止旧程序无法兼容新数据库。[AMI复制](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/how-ami-copy-works.html)

还要测量实例启动、配置加载和ALB检查的耗时，并核对配额与实际容量。配置了扩容规则，不代表随时都能立即拿到所需资源。

数据库按自己的复制方案管理，增加一台EC2并不会自动得到可写数据库副本。

### 凭据与配置

Secrets Manager支持跨区域复制凭据。备用应用仍需具备读取权限，以及相应的KMS解密权限。[凭据复制](https://docs.aws.amazon.com/secretsmanager/latest/userguide/replicate-secrets.html)

复制秘密内容，不会自动把其中的主库地址换成备用地址。接管步骤要包含配置更新，以及必要的连接池刷新或应用重启。

### 后台任务

超时关单、通知和结算也属于业务恢复范围。主备设计下，要明确哪个区域能够执行写入和后台任务，避免重复处理订单或形成双主。

隔离机制必须提前设计，并能处理旧区域失联的情况。故障后才尝试登录旧服务器停任务，可能已经无法执行。

## 六、恢复与演练

操作手册可以按以下顺序组织：

1. 监控发现异常，确认故障范围，由负责人决定启动灾备。
2. 执行旧区域写入及后台任务的隔离方案。
3. 在B区域还原备份，或提升PostgreSQL备用库、执行Oracle Failover，并核对恢复进度。
4. 启动、扩容应用，更新数据库与存储等配置。
5. 验证登录、查询、测试下单和附件读取，确认处理能力。
6. 切换入口，观察错误率、响应时间及实际订单处理。

没有依赖关系的工作可以并行。例如，数据库准备时也可以扩容应用，但对外开放写入必须等接管条件满足。

这些步骤可以整理为Systems Manager Automation运行手册。监控、决策和执行入口本身，也要能在A区域不可用时使用。

演练采用接近生产的数据量和负载，从服务中断计时，直到关键功能与约定容量恢复。同时检查数据缺口是否控制在15分钟以内。[灾备演练建议](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_planning_for_recovery_dr_tested.html)

数据恢复太慢，就评估常驻副本；应用启动太慢，就考虑提前运行部分实例。投入多少准备，应由实测瓶颈决定。

A区域恢复后，也要先同步并核对B区域已经产生的新数据，再安排回切。
