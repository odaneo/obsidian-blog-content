隐藏元素时，需要同时考虑显示、交互和布局占位。

| 方式 | 是否可见 | 元素自身是否可交互 | 是否占据布局空间 |
| --- | --- | --- | --- |
| `display: none` | 否 | 否 | 否 |
| `visibility: hidden` | 否 | 否 | 是 |
| `opacity: 0` | 否 | 仍可点击、获取焦点 | 是 |

需要连同占位一起移除时，使用`display: none`；需要留出原位置时，可用`visibility: hidden`。

`opacity: 0`适合透明度过渡，但它只改变外观，透明元素仍可能挡住点击或获得键盘焦点。[MDN的透明度说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/opacity)
