---
Description: 前端进阶指南：利用 patch-package 维护过时依赖。以修复 React Native 组件库为例，详解从修改 node_modules 到自动应用补丁的全流程，确保旧包在现代开发环境中依然稳定运行。
Slug: patch-stale-deps
TagRefs:
  - "[[Tags/前端|前端]]"
SubTags:
  - "[[SubTags/JavaScript|JavaScript]]"
Published: true
Recommend: false
MeechoPolished: false
---
在把 React Native 从 0.71 升级到 0.76 的过程中，`react-native-snap-carousel` 这个库因为长期无人维护（版本停留在 5 年前），导致运行时出现了错误：

```plain text
Cannot read property 'style' of undefined
```

## 解决思路

使用 **patch-package** 对库进行补丁修复。参考：[相关讨论](https://github.com/meliorence/react-native-snap-carousel/issues/1041)

## 操作步骤

1. 在 `node_modules` 里修改好依赖代码（修复报错位置）。
2. 安装 `patch-package`：
```bash
npm install patch-package
```
3. 生成补丁文件：
```bash
npx patch-package react-native-snap-carousel
```
4. 在 `package.json` 中加入 `postinstall` 脚本，确保安装依赖后自动应用补丁：
```json
"scripts": {
  "postinstall": "patch-package"
}
```

这样就能在升级后继续使用旧包，而不会因为不兼容导致运行错误。
