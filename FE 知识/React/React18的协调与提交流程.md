Reconciler负责计算界面变化，决定哪些节点保留、插入、修改或删除。Fiber是保存组件关系、状态和更新信息的内部节点。

下面按React18.2.0的普通客户端更新流程说明。

## 接收更新

调用状态更新函数后，React记录更新、分配Lane，再通知根节点安排工作，内部会用到scheduleUpdateOnFiber和ensureRootIsScheduled。

已有任务仍适合当前优先级时，可以复用；需要更高优先级时，再重新安排。同步更新通常走内部同步队列，其他更新通常交给Scheduler。

## render阶段计算变化

Reconciler基于当前Fiber树创建或复用工作树，逐个处理节点：

| 动作 | 工作 |
| --- | --- |
| `beginWork` | 调用组件或处理节点，计算子节点 |
| `completeWork` | 完成节点准备，汇总子树变化标记 |

新的DOM节点可以提前创建，但尚未插入页面。已有页面的DOM改动等待提交阶段。

Scheduler安排回调何时运行，Reconciler负责遍历Fiber并计算组件变化。

## commit阶段应用改动

React18通过flags、subtreeFlags汇总变化，待删除子节点保存在deletions中。[React18标记定义](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberFlags.js)

普通DOM提交分为：

1. 改动前读取必要信息，例如getSnapshotBeforeUpdate。
2. 插入、修改或删除DOM。
3. 执行componentDidMount、componentDidUpdate和useLayoutEffect等逻辑。

核心提交过程同步执行，不会像并发render那样主动分片。

useEffect另行处理，通常可在绘制后执行，部分交互更新中也可能提前。[React18提交实现](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberWorkLoop.new.js)

## 哪些工作可以暂停

使用createRoot后，Transition等并发更新的render过程可以暂停、继续，或被更紧急的更新打断后重新计算。

SyncLane等同步更新通常一次完成render和commit，不主动让出执行；并非所有更新都会分片。[React18并发渲染说明](https://react.dev/blog/2022/03/29/react-v18#what-is-concurrent-react)
