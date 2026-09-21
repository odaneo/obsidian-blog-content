---
---
## 主要作用

- **清除内部浮动**
	容器创建 BFC 后，可以自动包含内部的浮动元素，避免塌陷。
- **避免外边距折叠**
	BFC 可以阻止相邻块级元素的外边距（margin）合并。
- **控制元素布局**
	BFC 内的元素不会与外部浮动元素重叠。

## 触发 BFC 的常见方式

- `overflow` 属性值不是 `visible`（如 `hidden`、`auto`、`scroll`）
- `display: flow-root;`
- `float` 不为 `none`
- `position` 为 `absolute` 或 `fixed`
- `display: inline-block`、`table-cell`、`table-caption`
- `html` 根元素自带 BFC
