---
Id: "d4b9d41090e74d1b9dfd718fd3ebab3b"
Description: 用订单写入和误删的例子，讲清PostgreSQL同步复制、WAL归档与pgBackRest时间点恢复，并比较PostgreSQL和Oracle两台、三台部署与RPO=0的关系。
Slug: postgresql-ha-pgbackrest-point-in-time-recovery
TagRefs:
  - "[[Tags/数据库|数据库]]"
SubTags:
  - "[[SubTags/PostgreSQL|PostgreSQL]]"
  - "[[SubTags/High Availability|High Availability]]"
  - "[[SubTags/Oracle Database|Oracle Database]]"
Published: false
Recommend: false
MeechoPolished: true
---

服务器故障时，需要有数据库接管服务；订单误删时，需要找回历史数据。前者依靠高可用，后者依靠备份恢复。

PostgreSQL复制为接管准备副本，pgBackRest管理备份和WAL归档。把两条流程都准备好，才能分别应对节点故障与误操作。

## WAL复制

WAL记录PostgreSQL的数据变化。主库产生日志，备用库接收后重放，逐步得到相同的数据。

```text
主库产生WAL
    ↓
WAL Sender发送日志
    ↓ 网络传输
备用库的WAL Receiver接收并保存
    ↓
备用库重放日志，更新自己的数据
```

复制连接由备用库发起。账号、地址和网络权限配置妥当后，日志传输由PostgreSQL进程负责。

主库可以直接连接多台备用库，也可以先发送给B1，再由B1传给B2、B3。后一种叫级联复制。下游是异步的，因此B1收到日志，并不意味着B2和B3也已收到。[PostgreSQL备库与复制](https://www.postgresql.org/docs/current/warm-standby.html)

## RPO为零的条件

用户提交订单，数据库返回成功，随后主库发生故障。RPO=0要求接管后的数据库仍保有这笔已确认的订单。

它衡量数据损失，不表示服务没有中断。恢复业务所需的时间由RTO衡量。

| 复制方式 | 提交成功前的等待 |
| --- | --- |
| 异步复制 | 无需等待备库持久保存对应日志 |
| 同步复制并等待备库落盘 | 等待指定备库将对应WAL保存到持久存储 |

要在设定的故障范围内保护已确认事务，需为这些事务配置同步提交，并选择拥有所需完整日志的备库接管。

如果要求每次成功提交都有两份持久副本，同步备库失联时就必须等待。降级为只写主库后，新的成功提交已不再满足这个要求。[PostgreSQL同步复制](https://www.postgresql.org/docs/current/warm-standby.html#SYNCHRONOUS-REPLICATION)

## 两台与三台

一主一同步备库，在主库失效、备库完好的情况下，也能保住已确认事务。三台并非实现RPO=0的固定门槛。

两台的主要限制，是故障后缺少冗余：

- 备库失效，主库失去同步写入的第二份副本。
- 主库失效，备库接管后只剩一个数据节点。若仍要求两份持久副本，就要先补回另一台。

一主两备增加了余量。复制进度和切换规则满足要求时，单台失效后，剩余两台仍有机会继续同步写入。Patroni推荐至少三个PostgreSQL数据节点，考虑的正是这种故障后的写入可用性。[Patroni复制模式](https://patroni.readthedocs.io/en/latest/replication_modes.html)

节点多也不能代替正确配置。三台全用异步复制，最新事务仍可能丢失；主库和最新的同步备库同时失效，也不能随意提升落后的第三台。

## Oracle的保护模式

Oracle Data Guard同样可以部署一主一备，通过同步传输redo并等待备库落盘，保护已确认事务。

唯一备库失联后，是否允许主库继续运行，取决于保护模式：

| 模式 | 无法取得同步备库确认时 |
| --- | --- |
| 最大可用性 | 主库可以继续运行，期间新事务可能缺少同步副本 |
| 最大保护 | 主库停止运行，避免继续提交缺少备库保护的事务 |

为降低单个备库故障造成主库停止的概率，Oracle在最大保护模式下也推荐至少两个备库，即一主两备。[Oracle Data Guard保护模式](https://docs.oracle.com/en/database/oracle/oracle-database/19/sbydb/oracle-data-guard-protection-modes.html)

自动故障转移FSFO还涉及Observer进程。它参与判断故障，不保存另一份业务数据。官方建议让它位于独立于主备数据库的计算机上。[Oracle Observer](https://docs.oracle.com/en/database/oracle/oracle-database/19/dgbkr/using-data-guard-broker-to-manage-switchovers-failovers.html)

## WAL归档

流复制用于让备库跟上数据，归档用于保留恢复所需的历史日志。

```text
PostgreSQL主库
    ├── 流复制 → 备用库
    └── WAL归档 → pgBackRest仓库

定期数据库备份 ──→ pgBackRest仓库
```

pg_wal里的旧日志会被回收，不适合作为长期备份。归档将已完成的WAL段保存到仓库，供后续恢复使用。

时间点恢复需要合适的基础备份，以及从备份推进到目标时刻所需的连续WAL。例如，还原上午的备份，再重放日志到下午的目标时间。[PostgreSQL连续归档与恢复](https://www.postgresql.org/docs/current/continuous-archiving.html)

归档进度与备库进度不同。备库已经收到订单日志，仓库却可能尚未归档包含它的完整日志段。

## pgBackRest配置

pgBackRest支持完整、差异和增量备份，也负责归档WAL和取回恢复日志。仓库可以使用其支持的S3对象存储。

stanza表示一套数据库备份配置。下面使用app作为名称，假设程序、数据库目录、仓库和访问权限已经准备就绪。[pgBackRest使用指南](https://pgbackrest.org/user-guide.html)

PostgreSQL归档配置示例：

```ini
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=app archive-push %p'
```

数据库准备好待归档的日志段后，会执行archive_command，调用pgBackRest存入仓库。

检查、备份和查看信息的命令如下：

```bash
# 检查配置和归档等条件
pgbackrest --stanza=app check

# 创建完整备份
pgbackrest --stanza=app --type=full backup

# 查看备份信息
pgbackrest --stanza=app info
```

这些命令负责备份。主库故障后的判断、隔离旧主库和选定新主库，应由高可用流程另行处理。[pgBackRest命令](https://pgbackrest.org/command.html)、[PostgreSQL故障转移](https://www.postgresql.org/docs/current/warm-standby-failover.html)

## 误删后的恢复

假设下午2点误删订单，1点55分仍正常。先在独立环境中恢复，便于检查和提取数据。

1. 明确目标时间及其时区。
2. 选定适用备份，检查恢复所需的WAL是否完整。
3. 用pgBackRest还原到独立数据目录，指定时间恢复目标。
4. 启动恢复实例，重放日志至目标位置。
5. 检查订单，决定补回误删数据，还是安排整体切换。

时间恢复使用--type=time、--target等参数。例如目标可写为2026-09-12 13:55:00+08，还需明确到达后是暂停，还是转为可写状态。[pgBackRest时间点恢复](https://pgbackrest.org/user-guide.html#pitr)

历史副本只包含目标时刻的数据。1点55分之后正常新增的订单也会缺席，因此不能未经核对就整体覆盖生产数据。

## 恢复验证

备库接管后，要继续归档和备份，保证新产生的数据也有恢复来源。

演练应分别验证故障切换耗时和历史数据恢复结果。备份任务成功，不能代替一次实际恢复。

跨区域恢复时，还要确认生产区域失效后，备用区域仍能取得备份、WAL和解密凭据。业务配合见[[AWS 异地灾备与业务恢复指南]]。
