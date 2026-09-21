---
Description: 以 1 小时 RTO、15 分钟 RPO 为例，从数据、网络、服务和恢复流程讲解 AWS 异地灾备。用自行部署的 PostgreSQL、Oracle 说明数据库恢复，并结合 S3、Route 53、ALB 和 EC2 介绍业务接管。
Slug: aws-cross-region-disaster-recovery
TagRefs:
  - "[[Tags/AWS|AWS]]"
SubTags:
  - "[[SubTags/High Availability|High Availability]]"
  - "[[SubTags/Architecture|Architecture]]"
  - "[[SubTags/PostgreSQL|PostgreSQL]]"
  - "[[SubTags/Oracle Database|Oracle Database]]"
Published: false
Recommend: false
MeechoPolished: true
---

网站平时运行正常，数据库也定期备份，看起来已经很稳了。但如果承载业务的整个区域突然无法访问，备份放在哪里？应用能不能在另一个区域启动？用户又该怎样访问新的服务？

这些问题，才是异地灾备需要提前回答的。

本文以一个部署在 AWS 上的 .NET 订单网站为例，把生产环境所在的区域叫作 A 区域，把准备接手业务的区域叫作 B 区域。我们希望在 A 区域不可用后，1 小时内恢复关键业务。

先明确恢复目标，再从数据、网络、服务和恢复流程四个方面展开。

## 先想清楚能停多久、能丢多少数据

| 指标         | 通俗理解          | 示例目标            |
| ---------- | ------------- | --------------- |
| RTO，恢复时间目标 | 出事以后，业务最多能停多久 | 1 小时内恢复         |
| RPO，恢复点目标  | 恢复的数据最多能落后多久  | 最多丢失最近 15 分钟的数据 |

假设系统在下午 2 点发生故障：

- RTO 是 1 小时，意味着目标是在下午 3 点前恢复业务。
- RPO 是 15 分钟，意味着恢复出来的数据至少应该覆盖到下午 1 点 45 分。

一个关心什么时候能继续营业，一个关心账本能找回到什么时候。恢复时间从业务中断开始计算，发现故障、准备环境、恢复数据和切换入口的时间，都要算进去。[AWS 对恢复目标的说明](https://docs.aws.amazon.com/prescriptive-guidance/latest/aws-multi-region-fundamentals/fundamental-1.html)

这里说的恢复，是用户能够正常登录、查询和提交订单，并且系统能承载约定的业务流量。只把首页打开，还不算恢复完成。

## 备用区域，平时要准备到哪一步

多可用区部署可以应对一个区域内的局部故障。本文考虑的是整个 A 区域不可用，因此需要在另一个区域准备恢复能力。[AWS 灾备架构说明](https://aws.amazon.com/blogs/architecture/disaster-recovery-dr-architecture-on-aws-part-i-strategies-for-recovery-in-the-cloud/)

常见的灾备方案有四种，主要区别是 B 区域平时准备到了哪一步。

| 方案 | B 区域平时的状态 | 故障后主要做什么 |
| --- | --- | --- |
| 备份与恢复 | 保存数据备份、程序和部署材料 | 创建环境、恢复数据、部署应用 |
| Pilot Light，最小核心待命 | 数据库副本等核心部分保持运行，应用尚未完整启动 | 启动或部署应用，完成数据与流量切换 |
| Warm Standby，缩小规模待命 | 一套完整但容量较小的环境已经运行 | 完成数据接管，扩容并接入流量 |
| 多区域双活 | 多个区域平时都在处理用户请求 | 把故障区域的流量转交给其余区域 |

Pilot Light 像已经备好设备和食材，但还没完整开门营业；Warm Standby 像一家正在营业的小店，要接下主店的客流，还得增加人手和座位。通常，备用环境准备得越充分，恢复时需要完成的工作越少，平时的投入也越高。[AWS 四种灾备策略](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)

RTO 是 1 小时，并不直接等于某一种方案。小系统可能通过备份恢复达到目标，大系统则可能需要持续运行的数据库副本和备用应用。具体选择要结合数据量、启动速度和演练结果。

下面以主备方式说明各部分需要准备什么，不要求所有应用平时都以完整生产规模运行。

## 数据层，让数据库和文件都能恢复

本文的数据库由团队自行部署和维护，没有采用RDS的方案。以运行在 EC2 上的 PostgreSQL 或 Oracle 为例，二者是可选的数据库方案，不要求一个网站同时使用两套数据库。S3 则保存图片和附件。

EC2 提供运行数据库的服务器，数据库的备份、日志复制和主备切换，需要由我们自己配置。

### PostgreSQL，用流复制准备异地备用库

可以先用基础备份在 B 区域建立备用库，再通过 PostgreSQL 流复制持续传输 WAL 日志。WAL 可以理解成数据库记录变化的流水账，备用库重放这些日志，就能逐步跟上主库的数据。

整个过程可以理解为：

A 区域 PostgreSQL 主库 → 传输 WAL → B 区域 PostgreSQL 备用库。

A 区域和 B 区域两边各有一个负责通信的进程：

|位置|进程|负责什么|
|---|---|---|
|A 区域主库|WAL Sender|把 WAL 发给备用库|
|B 区域备用库|WAL Receiver|接收 WAL，并写入备用库本地磁盘|

传输WAL时候，连接是 B 区域的备用库主动向 A 区域主库建立的：

```
B 区域备用库主动连接 A 区域主库
                ↓
A 区域 WAL Sender 持续发送 WAL
                ↓
B 区域 WAL Receiver 接收并保存
                ↓
B 区域恢复进程重放 WAL，更新数据
```


PostgreSQL 流复制默认是异步的，主库提交成功时，备用库可能还没收到或重放对应日志。因此，要持续检查复制是否中断、日志接收和重放是否落后。[PostgreSQL 流复制说明](https://www.postgresql.org/docs/current/warm-standby.html)

A 区域故障后，先按预案隔离旧主库的写入，再检查备用库的恢复进度，通过 `pg_ctl promote` 或 `pg_promote()` 将它提升为新主库，最后让应用连接过去。这里提到的是接管动作，完整流程还包括故障判断、旧主隔离和客户端重连。[PostgreSQL 故障转移说明](https://www.postgresql.org/docs/current/warm-standby-failover.html)

例如，下午 2 点发生故障，备用库只收到截至 1 点 58 分的事务日志，那么这之后尚未复制过来的变化就存在丢失风险。能否满足 15 分钟的 RPO，要看实际复制进度。

### Oracle，用 Data Guard 准备异地备用库

Oracle 可以用 Data Guard 维护异地备用数据库。本文以物理备用库为例：主库把 redo 日志传到 B 区域，备用库通过 Redo Apply 应用日志，让数据跟上主库。

它和 PostgreSQL 的思路相近，都是把数据库的变化持续送到另一边，但使用的是 Oracle 自己的复制和恢复机制。

Oracle 中有两个容易混淆的操作：

| 操作 | 常见场景 | 含义 |
| --- | --- | --- |
| Switchover，计划切换 | 维护、演练，主备仍可正常配合 | 有计划地交换主备角色 |
| Failover，故障转移 | 主库已经不可用 | 让备用库接管主库角色 |

本文的区域故障场景主要涉及 Failover。是否会丢数据，取决于保护模式和故障时日志传输、应用的状态，不能把“配置了 Data Guard”直接理解成零数据丢失。[Oracle Data Guard 说明](https://docs.oracle.com/en/database/oracle/oracle-database/19/sbydb/introduction-to-oracle-data-guard-concepts.html)

Data Guard 是 Oracle Enterprise Edition 的功能；让物理备用库在持续应用日志的同时开放只读查询，涉及另行授权的 Active Data Guard。这里的示例只要求备用库能够接管业务。[Oracle Data Guard 与 Active Data Guard](https://docs.oracle.com/en/database/oracle/oracle-database/26/haovw/oracle-data-guard.html)

### 从备份恢复，也要保留完整的日志

如果选择备份与恢复方案，也可以不持续运行完整的备用数据库，但需要提前把备份和恢复所需的日志送到 B 区域。

- PostgreSQL 可以使用基础备份和连续归档的 WAL，恢复到日志覆盖范围内的指定时间点。[PostgreSQL 归档与时间点恢复](https://www.postgresql.org/docs/current/continuous-archiving.html)
- Oracle 可以使用 RMAN 管理备份，再结合归档 redo 日志等材料完成恢复；控制文件、服务器参数文件等恢复材料也要纳入准备。[Oracle RMAN 备份恢复](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/getting-started-rman.html)

这些备份文件可以通过配置好的上传流程保存在 S3，并复制到 B 区域。S3 负责保存文件，具体怎样还原成可用数据库，仍由 PostgreSQL 或 Oracle 的恢复工具完成。

恢复耗时包括取回备份、还原数据、重放日志和验证业务。数据量越大，越需要提前测量，确认是否能在 1 小时内完成。

同样，每 15 分钟备份一次，不代表一定能达到 15 分钟的 RPO。真正要看的是：B 区域是否已经拥有恢复到目标时间点所需的备份和完整日志。

### S3，把图片和附件一起带过去

S3 可以配置跨区域复制，将符合规则的对象复制到 B 区域的存储桶。

这种复制也是异步的。启用规则之前已经存在的文件，需要通过 S3 Batch Replication 等方式补齐；打开复制开关，不代表历史文件已经全部到位。[S3 复制说明](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)

例如，订单记录里保存了附件地址，但附件仍然只在 A 区域，用户恢复访问后依然打不开它。因此，恢复应用时还要切换存储桶配置，并检查文件是否可读。

数据库和文件各自复制，也可能出现进度不一致。演练时应验证完整业务记录及其附件，而不只是看两边的数据数量。

### 历史备份，保留回到错误发生前的能力

即使已经使用数据库副本，也应该保留历史备份。

假设一次错误操作删除了一批订单，复制可能把删除结果一起传到 B 区域。此时切换区域解决不了问题，需要恢复到删除前的正确状态。[AWS 对复制与备份的说明](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)

本文的 1 小时目标针对区域不可用。误删、数据损坏等情况，还要考虑发现错误和寻找正确恢复点的时间，单独验证恢复目标。

## 网络层，让用户能进来，让服务能连通

数据准备好之后，要把访问路径也准备好：用户怎样访问备用网站，应用怎样访问备用数据库，又怎样调用外部接口。

### VPC 和 ALB，准备备用区域的网络

B 区域需要自己的网络和入口。下面这些组件可以提前部署，并完成连通性验证。

| AWS 组件 | 在备用区域负责什么 |
| --- | --- |
| VPC、子网和路由表 | 提供应用与数据库运行的网络 |
| ALB | 接收请求，并转发到备用应用 |
| 安全组 | 放行 ALB 到应用、应用到数据库等必要通信 |
| Internet Gateway | 为公网入口提供所需的互联网路径 |
| NAT Gateway 或 VPC Endpoint | 按依赖需要，让私有子网中的应用访问外部服务或 AWS 服务 |
| ACM 证书 | 让备用 ALB 能为业务域名提供 HTTPS |

可以用 CloudFormation 保存和管理环境定义，减少临时手工搭建的工作。两边使用一致的设计，区域、子网和资源地址分别配置。具体流量路径可以结合 [[AWS VPC 网络入门]] 阅读。

一个容易遗漏的问题是：备用应用虽然在 B 区域，访问外部接口却仍经过 A 区域的代理或网络出口。A 区域一旦失联，这条依赖也会断掉，所以备用环境需要能够独立完成关键业务。

### 跨区域连接，让数据库日志能够传过去

自行部署的主备数据库还需要一条跨区域通信路径。例如，可以使用跨区域 VPC Peering，让两个 VPC 中的数据库通过私有地址通信，并配置两侧路由和必要的安全组规则。[AWS 跨区域 VPC 连接](https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html)

这条路径用于平时的日志复制。发生区域故障后，B 区域的应用应访问 B 区域的新主库，避免正常业务仍依赖失联的 A 区域。

### Route 53，把用户引导到备用入口

平时，业务域名指向 A 区域的 ALB。B 区域准备好后，可以通过 Route 53 的主备故障转移配置，让域名查询返回备用入口。

不过，健康检查和恢复流程要配合起来。数据库还没恢复、备用库仍然只读，或者应用还在启动时，不能因为一个简单的首页检查成功，就认定备用环境已经可以接单。[Route 53 灾备切换设计](https://aws.amazon.com/blogs/networking-and-content-delivery/creating-disaster-recovery-mechanisms-using-amazon-route-53/)

DNS 缓存也会影响切换速度。部分客户端会在缓存有效期间继续使用旧地址，因此，切换解析结果不代表所有用户同时转向新环境。TTL 应提前规划，客户端重试和已有连接也需要在演练中观察。[Route 53 DNS 最佳实践](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/best-practices-dns.html)

## 服务层，让程序和配置一起恢复

网络打通之后，还要让正确版本的程序，在正确的配置下运行起来。

### EC2 和 Auto Scaling，准备好启动与扩容

假设 .NET 应用运行在 EC2 上，可以用 Auto Scaling Group 管理应用实例数量。数据库实例则按自己的主备方案管理，不能像无状态应用一样简单增加实例就得到可写副本。

采用 Pilot Light 时，备用应用实例可以在故障后启动；采用 Warm Standby 时，则提前运行少量实例，接管时再扩容。两种方式都需要验证启动、加载配置和通过 ALB 健康检查的耗时。

程序和镜像也要在 B 区域可用。例如，提前复制所需的 AMI，并准备当地的启动模板，避免故障发生后才发现镜像仍只存在于 A 区域。[EC2 AMI 复制](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/how-ami-copy-works.html)

每次更新生产版本，也要同步维护备用环境所需的部署材料。否则，数据库已经升级，备用区域却启动了一份不兼容的旧程序，仍然无法恢复业务。

实例配额和容量也要检查。配置了自动扩容，并不代表需要时一定能立即获得足够的计算资源。

### Secrets Manager，准备凭据和区域配置

应用还需要数据库密码、业务密钥、存储桶名称和各种接口地址。

Secrets Manager 支持将凭据复制到其他区域，让备用应用可以在 B 区域读取它们。相应的 IAM 权限和 KMS 解密权限也需要提前验证。[Secrets Manager 跨区域复制](https://docs.aws.amazon.com/secretsmanager/latest/userguide/replicate-secrets.html)

复制凭据内容，不会自动把里面的数据库地址改成备用地址。数据库接管后，连接配置的更新、连接池刷新或应用重启，都要写进恢复步骤。

### 后台任务，明确由哪个区域执行

网站除了处理用户请求，可能还会定时关闭超时订单、发送通知或执行结算。这些任务也需要纳入恢复范围。

本文采用单区域写入的主备设计。接管前，要按预案隔离旧区域的写入和后台任务，避免两边同时修改各自的数据，或重复处理同一笔订单。

这种隔离机制需要提前设计，能够应对旧区域失联。不能等故障发生后，才打算远程登录旧服务器手动停机。

## 恢复流程，把几个部分按顺序接起来

数据、网络和服务都准备好之后，可以把恢复过程整理成一份操作手册：

1. 通过 CloudWatch 等监控发现异常，确认故障范围，人工决定是否启动异地恢复。
2. 按预案隔离旧区域的写入和后台任务，防止两边同时接管。
3. 在 B 区域恢复数据库备份，或执行 PostgreSQL 备用库提升、Oracle Data Guard 故障转移，并核对数据进度。
4. 启动或扩容应用，更新数据库、文件存储和其他区域配置。
5. 验证登录、查询、提交测试订单和读取附件等关键功能。
6. 在备用业务就绪后切换访问入口，持续观察错误率、响应时间和业务处理情况。

互不依赖的步骤可以并行，例如数据库准备和应用扩容。需要依赖前一步结果的操作，则要等待条件满足。可以使用 Systems Manager Automation 将这些步骤整理为自动化运行手册，恢复入口本身也应避免依赖 A 区域。[AWS 恢复自动化示例](https://aws.amazon.com/blogs/networking-and-content-delivery/creating-disaster-recovery-mechanisms-using-amazon-route-53/)

要知道能否在 1 小时内完成，就用接近真实的数据量和负载演练一次：从业务中断开始计时，到关键业务及约定处理能力恢复为止，同时检查恢复的数据是否满足 15 分钟的 RPO。

如果数据库恢复占去了大半个小时，就考虑持续维护副本；如果应用启动太慢，就考虑提前运行部分实例。让演练结果决定需要增加哪些准备。[AWS 灾备演练建议](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_planning_for_recovery_dr_tested.html)

A 区域恢复之后，也不要急着把流量切回去。B 区域已经接收了新订单，应先完成数据同步和核对，再安排回切。
