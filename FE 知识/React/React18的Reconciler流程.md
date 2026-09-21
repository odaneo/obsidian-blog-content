---
Description: 按接收更新、计算界面和提交DOM三个步骤，解释React18的Reconciler、Fiber与Scheduler如何配合。
Slug: react-reconciler
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/React|React]]"
Published: false
Recommend: false
MeechoPolished: true
---

Reconciler是React18中负责计算界面变化的部分。它比较新旧内容，决定哪些节点要保留、插入、修改或删除。

Fiber是React保存组件信息的内部节点。Fiber树记录组件之间的关系，也记录状态、待处理更新等信息。

下面按React18.2.0的普通客户端更新流程说明。

## 接收更新

调用`setState`或Hook的状态更新函数后，React会记录更新，为它分配Lane，并通知根节点安排后续工作。

`scheduleUpdateOnFiber`和`ensureRootIsScheduled`参与这个过程，它们属于内部实现。

React已经安排了一个稍后处理这棵组件树更新的任务，新来的更新可以一起交给它处理。需要更换优先级时，再调整任务安排。同步更新走内部同步队列，其他更新通常交给Scheduler。

同步更新通常指SyncLane，它是React18中优先级最高的一类更新。轮到同步更新执行时，React会一口气完成render和commit，中途不主动暂停让出执行机会。

## 计算新界面

这一步叫render阶段。Reconciler从当前的Fiber树出发，创建或复用一棵工作中的树，逐个处理节点。

主要有两个动作：

| 动作 | 做什么 |
| --- | --- |
| `beginWork` | 调用组件或处理节点，计算它的子节点 |
| `completeWork` | 完成当前节点的准备，并汇总子树的变化标记 |

需要插入的DOM可以在这里提前创建，但还没有插入到页面。已有界面的DOM改动，要等提交阶段。

构建Fiber树的是Reconciler。Scheduler负责安排回调何时运行，不负责比较组件。

## 提交DOM改动

计算完成后进入commit阶段，把确定的变化应用到页面。

React18通过`flags`和`subtreeFlags`记录、汇总变化，例如插入、属性更新和子节点删除。需要删除的子节点记录在`deletions`中，不再用旧版的整树effect list描述这套流程。[React18标记定义](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberFlags.js)

普通DOM提交可以分成：

1. 改动前读取必要信息，例如`getSnapshotBeforeUpdate`。
2. 插入、修改或删除DOM。
3. 执行`componentDidMount`、`componentDidUpdate`、`useLayoutEffect`等逻辑。

这段提交不会像并发render那样主动分片让出执行。

`useEffect`另行处理，通常可以等到浏览器绘制后。但React18的部分交互更新会在绘制前执行它，因此不能把它的位置固定写成“永远最后”。[React18提交实现](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberWorkLoop.new.js)

## 哪里可以暂停

使用`createRoot`后，Transition等并发更新的render过程可以暂停、继续，或被更紧急的更新打断并重新计算。

并非所有更新都会分片。提交DOM的核心过程也不能做到一半就暂停，等待下次再改剩余部分。[React18并发渲染说明](https://react.dev/blog/2022/03/29/react-v18#what-is-concurrent-react)
