元素怎样参与布局，主要由CSS的`display`决定。下面比较普通文档流中的三种常见显示方式。

| 类型 | 是否独占一行 | width和height | margin与padding | 常见例子 |
| --- | --- | --- | --- | --- |
| 行内 | 否 | 普通非替换元素通常不生效 | 左右影响布局；上下margin不生效，上下padding可绘制但通常不撑开行盒 | `span`、`a`、`strong` |
| 块级 | 通常从新行开始 | 可以设置 | 四个方向均参与布局 | `div`、`p`、`h1` |
| 行内块 | 否 | 可以设置 | 四个方向均生效 | 设置了`display: inline-block`的元素 |

`img`是替换元素，虽然默认是行内显示，仍可设置宽高。因此，“行内元素不能设置宽高”需要限定为普通非替换行内元素。[MDN的图片布局说明](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#styling_with_css)

HTML标签有默认样式，但可以通过`display`改变布局。例如，`span`设置`display: block`后会按块级盒子布局。
