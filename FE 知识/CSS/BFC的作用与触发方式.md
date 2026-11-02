BFC是块级格式化上下文，可以理解为一块独立的布局区域，区域内的浮动和外边距按相应规则处理。

## 主要作用

| 场景 | 创建BFC后的效果 |
| --- | --- |
| 子元素浮动导致容器高度塌陷 | 容器计算高度时包含内部浮动 |
| 父子外边距折叠 | 外边距不再跨越BFC边界折叠 |
| 普通流中的容器与外部浮动重叠 | BFC容器会避开外部浮动 |

同一BFC内部，相邻兄弟块的垂直外边距仍可能折叠。创建BFC不会取消所有margin合并。[MDN的BFC说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Block_formatting_context)

## 常见触发方式

- `display: flow-root`。
- 块级盒子的`overflow`为`hidden`、`auto`或`scroll`。
- `float`不为`none`。
- `position`为`absolute`或`fixed`。
- `display: inline-block`、`table-cell`或`table-caption`。
- 文档根元素`html`。

单纯需要建立BFC时，`flow-root`通常更直接。`overflow: hidden`还会裁剪溢出内容，而`overflow: clip`本身不会创建BFC。[overflow说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)
