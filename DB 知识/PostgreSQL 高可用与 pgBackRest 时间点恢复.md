---
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

数据库服务器坏了，希望另一台接着工作；订单被误删了，希望把数据找回来。这两件事分别依靠高可用和备份恢复。

PostgreSQL通过主备复制准备接管节点，pgBackRest负责备份和WAL归档。两者配合，才能同时应对机器故障和数据误操作。

## WAL怎样复制

WAL是PostgreSQL记录数据变化的日志。可以把它理解成一份流水账：主库记录发生了什么变化，备用库按照日志做出相同的变化。

```text
主库产生WAL
    ↓
WAL Sender发送日志
    ↓ 网络传输
备用库的WAL Receiver接收并保存
    ↓
备用库重放日志，更新自己的数据
```

连接由备用库主动建立。配置好复制账号、连接地址和网络权限后，传输由PostgreSQL进程完成。

一个主库可以向多个备用库发送WAL。也可以先传给B1，再由B1转发给B2、B3，这叫级联复制。级联下游采用异步方式，B1收到日志时，另外两台不一定已经收到。[PostgreSQL复制说明](https://www.postgresql.org/docs/current/warm-standby.html)

## RPO=0需要什么条件

假设用户提交了一笔订单，数据库已经返回“提交成功”，随后主库发生故障。

RPO=0关注的是：接管后的数据库里，这笔已确认成功的订单还在不在。它不代表业务完全不停机，恢复服务需要多久由RTO衡量。

两种复制方式的区别，在于什么时候向用户确认成功：

| 复制方式 | 确认成功前等待什么 |
| --- | --- |
| 异步复制 | 不等待备用库完成日志持久保存 |
| 同步复制并等待备库落盘 | 等待指定备用库将对应WAL持久保存 |

对需要保护的事务配置好同步提交，再让拥有完整日志的备用库接管，就可以在预定故障范围内保护已确认的事务。同步备库失联时，如果仍要求每笔成功写入都有两份持久副本，提交就需要等待，不能悄悄改成只写主库。[PostgreSQL同步复制](https://www.postgresql.org/docs/current/warm-standby.html#SYNCHRONOUS-REPLICATION)

## PostgreSQL为什么常用三台

PostgreSQL并不是达到RPO=0就必须有三台。一主一同步备库也可以在主库故障、备库完好的情况下，保住已确认的事务。

两台的问题是少了余量：

- 备用库坏了，主库没有另一台可等待的同步备库。
- 主库坏了，备用库虽然能接管，但此时只剩一份数据库。继续要求每笔写入保存到两个节点，就得先恢复另一个副本。

增加到一主两备后，在节点数据进度和切换配置满足条件时，坏一台还有机会由剩下两台维持同步写入。Patroni文档建议至少三个PostgreSQL数据节点，针对的正是单台故障后的写入可用性。[Patroni复制模式](https://patroni.readthedocs.io/en/latest/replication_modes.html)

所以，三台增加的是故障后的余量。若三台全部采用异步复制，仍可能丢失最新事务；若主库和保存最新事务的同步备库一起损坏，也不能随意提升落后的第三台。

## Oracle两台就够了吗

在Data Guard方案中，Oracle也可以使用一主一备，通过同步传输redo并等待备库落盘，保护已确认的事务。

但它同样需要决定：唯一的备用库失联后，主库还写不写？

| Oracle保护模式 | 无法继续获得同步备库确认时 |
| --- | --- |
| 最大可用性 | 优先让主库继续运行，这段时间的新写入可能缺少同步副本保护 |
| 最大保护 | 停止主库运行，避免继续提交没有备用副本保护的事务 |

为减少单个备用库故障导致主库停止的情况，Oracle官方在最大保护模式下同样建议至少两个备用库，也就是一主两备。[Oracle Data Guard保护模式](https://docs.oracle.com/en/database/oracle/oracle-database/19/sbydb/oracle-data-guard-protection-modes.html)

如果使用自动故障转移FSFO，还会涉及Observer观察进程。它负责参与故障判断，不存放第三份业务数据。官方建议将它运行在独立于主备数据库的计算机上。[Oracle Observer说明](https://docs.oracle.com/en/database/oracle/oracle-database/19/dgbkr/using-data-guard-broker-to-manage-switchovers-failovers.html)

## WAL归档有什么用

流复制让备用库跟上当前数据，归档则把历史日志另外保存下来。

```text
PostgreSQL主库
    ├── 流复制 → 备用库
    └── WAL归档 → pgBackRest仓库

定期数据库备份 ──→ pgBackRest仓库
```

本地pg_wal中的旧日志会按规则回收，不能把它当作长期备份。归档会保存已完成的WAL日志段，后续可以用来恢复历史数据。

时间点恢复需要“适用的基础备份+恢复所需的连续WAL”。例如，先恢复上午的备份，再重放后续日志，就有机会把数据推进到下午某个指定时间。[PostgreSQL时间点恢复](https://www.postgresql.org/docs/current/continuous-archiving.html)

归档也有延迟。备用库已经收到一笔订单，不代表归档仓库已经保存了包含这笔订单的日志段。

## pgBackRest怎么使用

pgBackRest管理完整、差异和增量备份，也负责把WAL送进仓库、在恢复时取出来。仓库可以使用其支持的S3对象存储。

其中stanza是一套数据库备份配置的名称。下面用app表示这套配置，并假设pgBackRest、数据库路径、仓库和权限都已准备好。[pgBackRest使用指南](https://pgbackrest.org/user-guide.html)

PostgreSQL的归档配置可以写成：

```ini
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=app archive-push %p'
```

含义是：PostgreSQL准备好一个待归档日志段后，调用pgBackRest将它存入仓库。

常用操作有：

```bash
# 检查配置和归档等条件
pgbackrest --stanza=app check

# 创建完整备份
pgbackrest --stanza=app --type=full backup

# 查看备份信息
pgbackrest --stanza=app info
```

这些命令用于备份管理。主库故障后的判断、旧主隔离和新主选定，需要由另外的高可用流程负责。[pgBackRest命令说明](https://pgbackrest.org/command.html)、[PostgreSQL故障转移](https://www.postgresql.org/docs/current/warm-standby-failover.html)

## 误删后怎么恢复

假设下午2点误删了订单，确认1点55分时数据正常，可以先把数据库恢复到独立环境中：

1. 确定目标时间，写明时区。
2. 选择能恢复到这个时间的备份，确认相应WAL齐全。
3. 用pgBackRest将备份还原到独立数据目录，设置时间恢复目标。
4. 启动恢复用PostgreSQL，让它重放归档日志到目标位置。
5. 核对订单后，决定补回所需数据，还是安排整体切换。

时间恢复会用到`--type=time`和`--target`等参数。比如目标时间可以写成`2026-09-12 13:55:00+08`，并明确到达目标后暂停还是转为可写状态。[pgBackRest时间点恢复](https://pgbackrest.org/user-guide.html#pitr)

恢复出来的是那一刻的数据状态。1点55分之后正常产生的订单，也不会出现在这份历史副本里，因此需要核对后再处理生产数据。

## 恢复后的检查

备用库成为新主库后，也需要继续归档WAL、创建备份，让后续数据仍有恢复来源。

演练可以分别记录两个结果：主库故障后多久恢复业务，以及历史备份能否恢复到指定时间。备份任务显示成功，只说明备份过程完成；实际恢复才能验证整条流程。

跨区域场景还需要保证：生产区域不可用时，备用区域仍能访问备份、WAL和解密凭据。业务侧的配合可以参考[[AWS 异地灾备与业务恢复指南]]。